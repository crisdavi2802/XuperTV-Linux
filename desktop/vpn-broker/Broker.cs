using System;
using System.IO;
using System.IO.Pipes;
using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

// Private Windows edition only. No profile, certificate or credential is built
// into this binary. The controller supplies the profile through an authenticated
// local named pipe, then OpenVPN reads it from stdin, never from a plaintext file.
public static class XuperVpnBroker {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer {MaxJsonLength=524288,RecursionLimit=16};
 static readonly object Gate=new object();
 static Process Parent,Engine;static string ParentSid,Pipe,Adapter,ExitName,State="ready",Failure="";
 static EventWaitHandle ExitEvent;static volatile bool Shutdown,Desired;static IntPtr Job=IntPtr.Zero;
 static readonly HashSet<string> Allowed=new HashSet<string>(new string[]{"client","dev","proto","remote","resolv-retry","nobind","persist-key","persist-tun","remote-cert-tls","verify-x509-name","cipher","data-ciphers","data-ciphers-fallback","auth","auth-user-pass","auth-nocache","verb","tls-version-min","key-direction","pull","route-nopull","redirect-gateway","route","route-ipv6","pull-filter","explicit-exit-notify"});
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeClientProcessId(SafePipeHandle handle,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeServerProcessId(SafePipeHandle handle,out uint pid);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint processId);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32FirstW(IntPtr snapshot,ref ProcessEntry entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32NextW(IntPtr snapshot,ref ProcessEntry entry);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct ProcessEntry {public uint size,usage,pid;public UIntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string file;}
 static uint ParentOf(uint pid){IntPtr snapshot=CreateToolhelp32Snapshot(2,0);try{ProcessEntry e=new ProcessEntry();e.size=(uint)Marshal.SizeOf(typeof(ProcessEntry));if(Process32FirstW(snapshot,ref e))do{if(e.pid==pid)return e.parent;}while(Process32NextW(snapshot,ref e));return 0;}finally{CloseHandle(snapshot);}}
 static string Owner(Process process){IntPtr token;if(!OpenProcessToken(process.Handle,8,out token))throw new Exception("invalid_parent");try{return new WindowsIdentity(token).User.Value;}finally{CloseHandle(token);}}

 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct TrustFile {public uint size;public string path;public IntPtr file,subject;}
 [StructLayout(LayoutKind.Sequential)]struct TrustData {public uint size;public IntPtr policy,sip;public uint ui,revoke,choice;public IntPtr file;public uint action;public IntPtr state;public string url;public uint flags,context;}
 [DllImport("wintrust.dll",CharSet=CharSet.Unicode,ExactSpelling=true)]static extern int WinVerifyTrust(IntPtr window,ref Guid action,ref TrustData data);
 public static void VerifyEngine(string file){
  if(!File.Exists(file))throw new Exception("official_engine_missing");
  TrustFile info=new TrustFile {size=(uint)Marshal.SizeOf(typeof(TrustFile)),path=file};IntPtr ptr=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(TrustFile)));
  try{Marshal.StructureToPtr(info,ptr,false);TrustData trust=new TrustData {size=(uint)Marshal.SizeOf(typeof(TrustData)),ui=2,choice=1,file=ptr,flags=0x1000};Guid action=new Guid("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");
   if(WinVerifyTrust(IntPtr.Zero,ref action,ref trust)!=0)throw new Exception("official_signature_invalid");
   using(X509Certificate2 cert=new X509Certificate2(X509Certificate.CreateFromSignedFile(file))){if(!Regex.IsMatch(cert.Subject,@"(^|,\s*)CN=OpenVPN Inc\.?($|,)",RegexOptions.IgnoreCase))throw new Exception("official_publisher_invalid");}
  }finally{Marshal.DestroyStructure(ptr,typeof(TrustFile));Marshal.FreeHGlobal(ptr);}
 }
 static string Bin(string name){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"OpenVPN","bin",name);}

 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll")]static extern bool SetInformationJobObject(IntPtr job,int type,IntPtr data,uint length);
 [DllImport("kernel32.dll")]static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [StructLayout(LayoutKind.Sequential)]struct BasicLimits {public long processTime,jobTime;public uint flags;public UIntPtr min,max;public uint count;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct IoCounters {public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes;}
 [StructLayout(LayoutKind.Sequential)]struct ExtendedLimits {public BasicLimits basic;public IoCounters io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 static void ProtectChild(Process process){Job=CreateJobObject(IntPtr.Zero,null);if(Job==IntPtr.Zero)throw new Exception("process_isolation_failed");ExtendedLimits limits=new ExtendedLimits();limits.basic.flags=0x2000;IntPtr p=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ExtendedLimits)));try{Marshal.StructureToPtr(limits,p,false);if(!SetInformationJobObject(Job,9,p,(uint)Marshal.SizeOf(typeof(ExtendedLimits)))||!AssignProcessToJobObject(Job,process.Handle))throw new Exception("process_isolation_failed");}finally{Marshal.FreeHGlobal(p);}}

 public static void ValidateProfile(string profile){
  if(profile==null||profile.Length>262144)throw new Exception("profile_invalid");string block=null;bool ca=false,server=false,remote=false,client=false,dev=false;
  foreach(string raw in profile.Split('\n')){string line=raw.Trim();if(line.Length==0||line.StartsWith("#")||line.StartsWith(";"))continue;
   if(block!=null){if(line=="</"+block+">")block=null;continue;}
   if(line.StartsWith("<")){Match m=Regex.Match(line,"^<(ca|cert|key|tls-auth|tls-crypt|auth-user-pass)>$");if(!m.Success)throw new Exception("profile_inline_invalid");block=m.Groups[1].Value;if(block=="ca")ca=true;continue;}
   string[] parts=Regex.Split(line,@"\s+");string key=parts[0];if(!Allowed.Contains(key))throw new Exception("profile_option_rejected");
   if(key=="auth-user-pass"&&parts.Length!=1)throw new Exception("profile_external_credentials_rejected");
   if(key=="remote-cert-tls"&&parts.Length==2&&parts[1]=="server")server=true;
   if(key=="dev"){if(parts.Length!=2||parts[1]!="tun")throw new Exception("profile_device_rejected");dev=true;}
   if(key=="remote"){if(parts.Length<2||parts.Length>4||!Regex.IsMatch(parts[1],@"^[A-Za-z0-9][A-Za-z0-9.:-]*$"))throw new Exception("profile_remote_rejected");remote=true;}
   if(key=="client")client=true;
   if(key=="tls-version-min"&&(parts.Length<2||!new HashSet<string>(new string[]{"1.2","1.3"}).Contains(parts[1])))throw new Exception("profile_tls_rejected");
   if(key=="verb"&&(parts.Length!=2||!Regex.IsMatch(parts[1],"^[0-3]$")))throw new Exception("profile_log_rejected");
  }
  if(block!=null||!ca||!server||!remote||!dev||!client)throw new Exception("profile_verification_missing");
 }
 static string RunTap(string arguments){string tool=Bin("tapctl.exe");VerifyEngine(tool);using(Process p=Process.Start(new ProcessStartInfo(tool,arguments){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=Path.GetDirectoryName(tool)})){string result=p.StandardOutput.ReadToEnd();p.StandardError.ReadToEnd();if(!p.WaitForExit(15000)){p.Kill();throw new Exception("tap_driver_timeout");}if(p.ExitCode!=0)throw new Exception("tap_driver_missing");return result;}}
 static void Disconnect(){Desired=false;Process own;EventWaitHandle signal;string adapter;lock(Gate){own=Engine;signal=ExitEvent;adapter=Adapter;State="stopping";}
  if(signal!=null)try{signal.Set();}catch{}
  if(own!=null)try{if(!own.WaitForExit(8000)){own.Kill();own.WaitForExit(3000);}}catch{}
  if(adapter!=null)try{RunTap("delete "+adapter);}catch{Failure="own_adapter_cleanup_pending";}
  lock(Gate){Engine=null;Adapter=null;if(ExitEvent!=null){ExitEvent.Dispose();ExitEvent=null;}if(Job!=IntPtr.Zero){CloseHandle(Job);Job=IntPtr.Zero;}State="ready";}
 }
 static void Start(string profile){ValidateProfile(profile);lock(Gate){if(Desired||Engine!=null)throw new Exception("already_started");Desired=true;State="connecting";Failure="";}
  try{string engine=Bin("openvpn.exe");VerifyEngine(engine);string name="XUPERTVPLUS-"+Guid.NewGuid().ToString("N").Substring(0,12);
   string created=RunTap("create --hwid root\\tap0901 --name "+name);Match id=Regex.Match(created,@"\{[0-9a-fA-F-]{36}\}");if(!id.Success)throw new Exception("own_adapter_creation_failed");lock(Gate){Adapter=id.Value;}
   if(!Desired){Disconnect();return;}
   ExitName="Global\\XuperTvExit-"+Guid.NewGuid().ToString("N");EventWaitHandleSecurity security=new EventWaitHandleSecurity();security.SetAccessRuleProtection(true,false);security.AddAccessRule(new EventWaitHandleAccessRule(new SecurityIdentifier(ParentSid),EventWaitHandleRights.FullControl,AccessControlType.Allow));security.AddAccessRule(new EventWaitHandleAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),EventWaitHandleRights.FullControl,AccessControlType.Allow));bool isNew;
   ExitEvent=new EventWaitHandle(false,EventResetMode.ManualReset,ExitName,out isNew,security);
   Process p=new Process();p.StartInfo=new ProcessStartInfo(engine,"--config stdin --dev-node "+Adapter+" --service "+ExitName+" 0 --verb 3 --auth-nocache"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=Path.GetDirectoryName(engine)};
   DataReceivedEventHandler observe=(sender,e)=>{if(e.Data==null)return;if(e.Data.Contains("Initialization Sequence Completed")){State="connected";}if(e.Data.Contains("AUTH_FAILED")){Failure="authentication_failed";}if(e.Data.Contains("VERIFY ERROR")){Failure="server_certificate_failed";}};
   p.OutputDataReceived+=observe;p.ErrorDataReceived+=observe;
   lock(Gate){if(!Desired){Disconnect();return;}p.Start();Engine=p;}
   ProtectChild(p);p.BeginOutputReadLine();p.BeginErrorReadLine();p.StandardInput.Write(profile);p.StandardInput.Write("\n");p.StandardInput.Close();
  }catch{Disconnect();throw;}
 }
 static object Status(){lock(Gate){if(Engine!=null&&Engine.HasExited){State="error";if(Failure.Length==0)Failure="connection_closed";}return new {state=State,error=Failure,connected=State=="connected",interfaceIds=Adapter==null?new string[0]:new string[]{Adapter.Trim('{','}').ToLowerInvariant()},routingMayAffectAllWindows=true};}}
 static string ReadBounded(TextReader reader,int limit){StringBuilder text=new StringBuilder();for(int n=0;n<=limit;n++){int c=reader.Read();if(c<0||c=='\n')return text.ToString();text.Append((char)c);}throw new Exception("request_too_large");}
 static void Handle(NamedPipeServerStream pipe){using(pipe){try{uint pid;if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out pid)||ParentOf(pid)!=(uint)Parent.Id||Owner(Process.GetProcessById((int)pid))!=ParentSid)throw new Exception("client_not_authorized");
    using(StreamReader reader=new StreamReader(pipe,new UTF8Encoding(false),false,4096,true))using(StreamWriter writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true)){writer.AutoFlush=true;
     Dictionary<string,object> message;lock(Json){message=Json.Deserialize<Dictionary<string,object>>(ReadBounded(reader,524288));}
     string op=Convert.ToString(message["op"]);if(op=="start"){Start(Convert.ToString(message["profile"]));}else if(op=="disconnect"){Disconnect();}else if(op=="shutdown"){Disconnect();Shutdown=true;}else if(op!="status")throw new Exception("operation_rejected");
     string response;lock(Json){response=Json.Serialize(Status());}writer.WriteLine(response);
    }
   }catch{try{byte[] error=Encoding.UTF8.GetBytes("{\"state\":\"error\",\"error\":\"operation_failed\"}\n");pipe.Write(error,0,error.Length);pipe.Flush();}catch{}}}}
 static int Client(string pipeName,int server){
  using(NamedPipeClientStream pipe=new NamedPipeClientStream(".",pipeName,PipeDirection.InOut,PipeOptions.None,TokenImpersonationLevel.Identification)){
   pipe.Connect(8000);uint pid;if(!GetNamedPipeServerProcessId(pipe.SafePipeHandle,out pid)||pid!=(uint)server)throw new Exception("server_not_authorized");
   using(StreamWriter writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true))using(StreamReader reader=new StreamReader(pipe,new UTF8Encoding(false),false,4096,true)){writer.WriteLine(ReadBounded(Console.In,524288));writer.Flush();Console.WriteLine(ReadBounded(reader,8192));}
  }return 0;
 }
 public static int Main(string[] args){try{
  if(args.Length==4&&args[0]=="--client")return Client(args[1],Int32.Parse(args[3]));
  if(args.Length!=6||args[0]!="--pipe"||args[2]!="--parent"||args[4]!="--sid")return 2;
  if(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))return 3;
  Pipe=args[1];if(!Regex.IsMatch(Pipe,"^xupertv-vpn-[a-f0-9]{32}$"))return 2;Parent=Process.GetProcessById(Int32.Parse(args[3]));ParentSid=args[5];if(Owner(Parent)!=ParentSid)return 3;
  Thread watcher=new Thread(()=>{try{Parent.WaitForExit();}catch{}Shutdown=true;Disconnect();Environment.Exit(0);});watcher.IsBackground=true;watcher.Start();
  while(!Shutdown){PipeSecurity security=new PipeSecurity();security.SetAccessRuleProtection(true,false);security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(ParentSid),PipeAccessRights.FullControl,AccessControlType.Allow));security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),PipeAccessRights.FullControl,AccessControlType.Allow));
   NamedPipeServerStream pipe=new NamedPipeServerStream(Pipe,PipeDirection.InOut,8,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,security);pipe.WaitForConnection();ThreadPool.QueueUserWorkItem(_=>Handle(pipe));
  }Disconnect();return 0;
 }catch{return 1;}}
}

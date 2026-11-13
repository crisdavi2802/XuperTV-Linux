'use strict';

/* Small MPEG-TS indexer for virtual HLS. It never changes media bytes: it
 * finds HEVC random-access NALs and emits only packet-aligned byte ranges. */
var PACKET = 188;

function ptsAt(b, p) {
  return ((b[p] & 14) * 536870912) + (b[p + 1] * 4194304) + ((b[p + 2] & 254) * 16384) + (b[p + 3] * 128) + ((b[p + 4] & 254) / 2);
}

function create(length, readRange) {
  var x = { length: length, offset: 0, pmt: -1, video: -1, pat: 0, pts: 0,
    current: null, segments: [], complete: false, running: false, waiters: [] };
  function notify() { var w = x.waiters.splice(0); for (var i = 0; i < w.length; i++) { w[i](); } }
  function payload(b, p) {
    var afc = (b[p + 3] >> 4) & 3, at = p + 4;
    if (afc === 2 || afc === 0) { return -1; }
    if (afc === 3) { at += 1 + b[at]; }
    return at < p + PACKET ? at : -1;
  }
  function tableStart(b, at, pusi) { return pusi ? at + 1 + b[at] : at; }
  function parsePat(b, at, pusi) {
    at = tableStart(b, at, pusi); if (at < 0 || b[at] !== 0) { return; }
    var end = at + 3 + (((b[at + 1] & 15) << 8) | b[at + 2]) - 4;
    for (var p = at + 8; p + 3 < end; p += 4) { if (b[p] || b[p + 1]) { x.pmt = ((b[p + 2] & 31) << 8) | b[p + 3]; return; } }
  }
  function parsePmt(b, at, pusi) {
    at = tableStart(b, at, pusi); if (at < 0 || b[at] !== 2) { return; }
    var end = at + 3 + (((b[at + 1] & 15) << 8) | b[at + 2]) - 4;
    var p = at + 12 + (((b[at + 10] & 15) << 8) | b[at + 11]);
    while (p + 4 < end) { var typ = b[p], pid = ((b[p + 1] & 31) << 8) | b[p + 2], n = ((b[p + 3] & 15) << 8) | b[p + 4]; if (typ === 0x24) { x.video = pid; return; } p += 5 + n; }
  }
  function isAccess(b, at, end) {
    for (var i = at; i + 5 < end; i++) {
      var z = b[i] === 0 && b[i + 1] === 0 && ((b[i + 2] === 1) || (b[i + 2] === 0 && b[i + 3] === 1));
      if (z) { var n = i + (b[i + 2] === 1 ? 3 : 4), type = (b[n] >> 1) & 63; if (type === 19 || type === 20 || type === 21) { return true; } }
    }
    return false;
  }
  function access(pos) {
    if (!x.pts) { return; }
    var start = x.pat || pos;
    if (!x.current) { x.current = { start: start, pts: x.pts }; return; }
    var dur = (x.pts - x.current.pts) / 90000;
    if (dur < 5 || start <= x.current.start) { return; }
    x.segments.push({ start: x.current.start, end: start - 1, duration: dur });
    x.current = { start: start, pts: x.pts };
    notify();
  }
  function parse(b, base) {
    for (var p = 0; p + PACKET <= b.length; p += PACKET) {
      if (b[p] !== 0x47) { continue; }
      var pusi = !!(b[p + 1] & 64), pid = ((b[p + 1] & 31) << 8) | b[p + 2], at = payload(b, p);
      if (at < 0) { continue; }
      if (pid === 0) { x.pat = base + p; parsePat(b, at, pusi); continue; }
      if (pid === x.pmt) { parsePmt(b, at, pusi); continue; }
      if (pid !== x.video) { continue; }
      if (pusi && at + 13 < p + PACKET && b[at] === 0 && b[at + 1] === 0 && b[at + 2] === 1) {
        if (b[at + 7] & 128) { x.pts = ptsAt(b, at + 9); }
      }
      if (isAccess(b, at, p + PACKET)) { access(base + p); }
    }
  }
  function next() {
    if (x.offset >= x.length) { x.complete = true; if (x.current) { x.segments.push({ start: x.current.start, end: x.length - 1, duration: 10 }); } notify(); return; }
    var size = Math.floor((2 * 1024 * 1024) / PACKET) * PACKET, start = x.offset, end = Math.min(x.length - 1, start + size - 1);
    readRange(start, end, function (err, body) { if (err) { x.complete = true; notify(); return; } parse(body, start); x.offset = end + 1; setTimeout(next, 0); });
  }
  x.start = function () { if (!x.running) { x.running = true; next(); } };
  x.when = function (fn) { x.waiters.push(fn); };
  return x;
}
module.exports = { create: create };

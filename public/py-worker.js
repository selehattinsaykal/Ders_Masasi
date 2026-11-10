// Python çalıştırıcı (klasik Web Worker). Seçilen Pyodide derlemesini CDN'den yükler;
// her derleme farklı bir Python sürümü taşır. Çıktı parça parça ana iş parçacığına gönderilir.
/* global importScripts, loadPyodide */
let run = null

const HARNESS = `
import sys, io, time, traceback

class _Out(io.TextIOBase):
    LIMIT = 400000
    def __init__(self, post):
        self.post = post
        self.buf = []
        self.size = 0
        self.total = 0
        self.last = time.time()
    def writable(self):
        return True
    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        self.total += len(s)
        if self.total > self.LIMIT:
            raise RuntimeError("Çıktı çok uzun: 400.000 karakter sınırı aşıldı.")
        self.buf.append(s)
        self.size += len(s)
        if self.size > 4096 or time.time() - self.last > 0.05:
            self.flush()
        return len(s)
    def flush(self):
        if self.buf:
            self.post("".join(self.buf))
            self.buf = []
            self.size = 0
        self.last = time.time()

def _run(code, stdin, post):
    out = _Out(post)
    old = (sys.stdin, sys.stdout, sys.stderr)
    sys.stdin = io.StringIO(stdin)
    sys.stdout = out
    sys.stderr = out
    ok = True
    try:
        exec(compile(code, "<kod>", "exec"), {"__name__": "__main__"})
    except SystemExit:
        pass
    except BaseException as e:
        ok = False
        out.total = 0
        tb = e.__traceback__
        tb = tb.tb_next if tb is not None else None
        traceback.print_exception(type(e), e, tb)
    finally:
        try:
            out.flush()
        finally:
            sys.stdin, sys.stdout, sys.stderr = old
    return ok
`

self.onmessage = async (e) => {
  const msg = e.data
  if (msg.type === 'init') {
    try {
      importScripts(msg.indexURL + 'pyodide.js')
      const pyodide = await loadPyodide({ indexURL: msg.indexURL })
      pyodide.runPython(HARNESS)
      run = pyodide.globals.get('_run')
      const version = pyodide.runPython('import sys; sys.version.split()[0]')
      self.postMessage({ type: 'ready', version })
    } catch (err) {
      self.postMessage({ type: 'init-error', error: String((err && err.message) || err) })
    }
    return
  }
  if (msg.type === 'run') {
    const post = (text) => self.postMessage({ type: 'out', id: msg.id, text: String(text) })
    let ok = false
    try {
      ok = !!run(msg.code, msg.stdin || '', post)
    } catch (err) {
      post('\n' + String((err && err.message) || err) + '\n')
    }
    self.postMessage({ type: 'done', id: msg.id, ok })
  }
}

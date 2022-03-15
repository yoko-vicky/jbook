import * as esbuild from 'esbuild-wasm';
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { unpkgPathPlugin } from './plugins/unpkg-path-plugin';
import { fetchPlugin } from './plugins/fetch-plugin';

const App = () => {
  const ref = useRef<any>();
  const iframe = useRef<any>();
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');

  const startService = async () => {
    ref.current = await esbuild.startService({
      worker: true,
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.8.27/esbuild.wasm',
    });
  };

  useEffect(() => {
    startService();
  }, []);

  const handleSubmit = async () => {
    if (!ref.current) {
      return;
    }

    // submitボタンがクリックされたら、
    // 0. 毎回新しいコードのバンドルが実行される前に、iframe内（子）のコードをリセットする
    iframe.current.srcdoc = html;

    // 1. esbuildを実行し
    const result = await ref.current.build({
      entryPoints: ['index.js'],
      bundle: true,
      write: false,
      plugins: [unpkgPathPlugin(), fetchPlugin(input)],
      define: {
        'process.env.NODE_ENV': '"production"',
        global: 'window',
      },
    });

    // 2. esbuild後の結果テキストをiframeのwindowにpostMessage(message event発生)し、
    // buildしたコード(transpile後のコード)を送る=> eventの中のdataとして受け取れる
    iframe.current.contentWindow.postMessage(result.outputFiles[0].text, '*');
  };

  // iframeにsrcDocとして送信する内容（iframe内に描画されるcode）
  // script内の内容: messageが発生したら(postMessage)、
  // そのdata（postMessageから受け取ったデータ）を評価し実行せよ
  // もしうまくいかなかったら、rootにエラーメッセージを表示
  const html = `
  <html>
    <head></head>
    <body>
      <div id="root"></div>
      <script>
        window.addEventListener('message', (event)=>{
          try{
            eval(event.data);
          } catch(err){
            const root = document.querySelector('#root');
            root.innerHTML = '<div style="color: red;"><h4>Runtime Error</h4> ' + err + '</div>';
            console.error(err);
          }
        }, false);
      </script>
    </body>
  </html>
`;

  // sandboxは何も指定しないと親(iframeを表示する方)・子(iframeの中身)間で
  // 自由にデータにアクセス可能 = デフォルト設定はsandobox="allow-same-origin"
  // sandbox="" 空欄stringにするか、他の"allow-scripts"などを指定することで
  // 親から子へのアクセスを制限する
  return (
    <div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
      ></textarea>
      <div>
        <button onClick={handleSubmit}>Submit</button>
      </div>
      <pre>{code}</pre>
      <iframe ref={iframe} srcDoc={html} sandbox="allow-scripts"></iframe>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));

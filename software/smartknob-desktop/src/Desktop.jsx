import React,{useCallback,useEffect,useRef,useState} from 'react';
import {APP_IDS,APP_INFO} from './model.js';
import {useDesktopController} from './useDesktopController.js';
import {fitRect,initialRect,initialWindows,topWindow} from './windowState.js';
import Icon,{Symbol} from './Icon.jsx';
import Window from './Window.jsx';
import KnobPanel from './KnobPanel.jsx';
import AppContent from './apps/index.jsx';

const screen=(element)=>{const rect=element?.getBoundingClientRect();return rect?.width>0&&rect?.height>0?{width:rect.width,height:rect.height}:{width:window.innerWidth,height:window.innerHeight};};
function MenuClock(){const [now,setNow]=useState(()=>new Date());useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);return <time dateTime={now.toISOString()}>{now.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})}<span>{now.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</span></time>;}
function Help({close}) {
 const descriptions=[['ブラウザ','回してタブを選び、押して開きます。'],['ウィンドウ','アプリを選んで押すと切り替わります。写真・タイマー・音楽は強いクリック。'],['タイマー','5分ごとに吸着。押して開始・一時停止。画面と論理目盛りが残り時間に追従します。'],['写真','露出・彩度・色温度。押すと調整項目が切り替わります。'],['動画','1フレームずつ送ります。押すと1秒単位に切り替わります。'],['音楽','再生速度・テンポを調整。等速に吸着します。'],['オーディオ','左右の定位を調整。中央に吸着し、端で止まります。'],['照明','明るさを調整。押すと色温度へ。普段の値に吸着します。'],['レビュー','変更箇所を選び、押して展開。長押しで次のファイル。'],['リーダー','1ページごとのクリック。章の先頭は強く、押すと次の章へ。'],['マップ','定番倍率を順に選びます。100%は強いクリック。'],['入力','星評価・優先度・数量を選び、押して確定します。']];
 return <div className="modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}><section className="help-window" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="help-header"><h2 id="help-title">操作ガイド</h2><button onClick={close} aria-label="操作ガイドを閉じる" autoFocus><Symbol name="close"/></button></div><p>デスクトップのアイコンをダブルクリックして開きます。ウィンドウをクリックすると、ノブの操作先が切り替わります。</p><div className="shortcut-row"><span><kbd>←</kbd><kbd>→</kbd> 回す</span><span><kbd>Space</kbd> 押す／長押し</span><span><kbd>Shift</kbd> ＋矢印で10目盛り</span></div><div className="help-apps">{descriptions.map(([name,desc],i)=><div key={name}><Icon id={APP_IDS[i]} size={32}/><p><b>{name}</b><span>{desc}</span></p></div>)}</div><p className="help-note">このデスクトップ内のアプリが操作対象です。音声は各アプリの再生ボタンで有効にしてください。実機は押下時間を取得できないため、2回押しを長押しと同じ操作にしています。タイマーは論理目盛りの同期で、実機を自動回転させるものではありません。</p></section></div>;
}
export default function Desktop({embedded=false,containerElement=null,bridgeFactory,enabled=true}={}){
 const desktopRef=useRef(null);
 const [viewport,setViewport]=useState(()=>screen(containerElement));
 const [windows,setWindows]=useState(()=>initialWindows(screen(containerElement)));
 const [active,setActive]=useState('photo');
 const [selected,setSelected]=useState(null);
 const [launcher,setLauncher]=useState(false);
 const [help,setHelp]=useState(false);
 const windowsRef=useRef(windows);windowsRef.current=windows;
 const viewportRef=useRef(viewport);viewportRef.current=viewport;
 const focus=useCallback(id=>{setActive(id);setWindows(previous=>previous.map(w=>w.id===id?{...w,minimized:false,z:Math.max(...previous.map(x=>x.z),0)+1}:w));},[]);
 const open=useCallback(id=>{
  if(!APP_IDS.includes(id))return;
  setLauncher(false);setSelected(id);setActive(id);
  setWindows(previous=>{
   const z=Math.max(...previous.map(w=>w.z),0)+1;
   return previous.some(w=>w.id===id)?previous.map(w=>w.id===id?{...w,minimized:false,z}:w):[...previous,{id,...initialRect(id,viewportRef.current,previous.length%4),z,minimized:false,maximized:false}];
  });
 },[]);
 const controller=useDesktopController({active:help?null:active,onOpen:open,bridgeFactory,enabled});
 const {apps,dispatch,status,notice,clearNotice,connect,disconnect,turn,press,longPress}=controller;
 const close=useCallback(id=>{
  if(['video','music','audio'].includes(id))dispatch({type:'set',app:id,key:'playing',value:false});
  const next=windowsRef.current.filter(w=>w.id!==id);setWindows(next);if(active===id)setActive(topWindow(next));
 },[active,dispatch]);
 const minimize=useCallback(id=>{
  if(['video','music','audio'].includes(id))dispatch({type:'set',app:id,key:'playing',value:false});
  const next=windowsRef.current.map(w=>w.id===id?{...w,minimized:true}:w);setWindows(next);if(active===id)setActive(topWindow(next));
 },[active,dispatch]);
 const maximize=useCallback(id=>setWindows(previous=>previous.map(w=>w.id===id?{...w,maximized:!w.maximized}:w)),[]);
 const move=useCallback((id,rect)=>setWindows(previous=>previous.map(w=>w.id===id?{...w,...fitRect(rect,viewportRef.current),z:w.z}:w)),[]);
 useEffect(()=>{const element=containerElement||desktopRef.current;const resize=()=>{const rect=element?.getBoundingClientRect();if(!rect?.width||!rect?.height)return;const next={width:rect.width,height:rect.height};setViewport(next);setWindows(previous=>previous.map(w=>({...w,...fitRect(w,next)})));};const observer=new ResizeObserver(resize);observer.observe(element);resize();window.addEventListener('resize',resize);return()=>{observer.disconnect();window.removeEventListener('resize',resize);};},[containerElement]);
 const inputRef=useRef({turn,press,longPress,active,help,enabled});inputRef.current={turn,press,longPress,active,help,enabled};
 useEffect(()=>{
  let holding=null,holdTimer=null,performed=false;
  const cancel=()=>{clearTimeout(holdTimer);holding=null;performed=false;};
  const keydown=e=>{
   if(!inputRef.current.enabled)return;
   const target=e.composedPath()[0];
   if(e.key==='Escape'){setHelp(false);setLauncher(false);cancel();return;}
   if(target.closest?.('input,textarea,select,[contenteditable=true]')||e.ctrlKey||e.metaKey||e.altKey||inputRef.current.help)return;
   if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();inputRef.current.turn((e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1));}
   if(e.code==='Space'&&!target.closest?.('button')){
    e.preventDefault();if(e.repeat||holding)return;holding=inputRef.current.active;performed=false;
    holdTimer=setTimeout(()=>{if(holding===inputRef.current.active){performed=true;inputRef.current.longPress();}},650);
   }
  };
  const keyup=e=>{if(e.code==='Space'&&holding){e.preventDefault();if(!performed&&holding===inputRef.current.active)inputRef.current.press();cancel();}};
  const scope=window;
  scope.addEventListener('keydown',keydown);scope.addEventListener('keyup',keyup);window.addEventListener('blur',cancel);
  return()=>{cancel();scope.removeEventListener('keydown',keydown);scope.removeEventListener('keyup',keyup);window.removeEventListener('blur',cancel);};
 },[embedded,enabled]);
 const pending=['selecting','connecting','disconnecting'].includes(status.phase);
 return <main ref={desktopRef} className="desktop" data-embedded={embedded||undefined} onPointerDown={e=>{if(e.target===e.currentTarget){setSelected(null);setLauncher(false);}}}>
  <header className="menu-bar"><div className="menu-left"><button className="desktop-brand" onClick={()=>setHelp(true)} title="SmartKnob Desktop 操作ガイド"><Symbol name="knob" size={20}/><strong>SmartKnob Desktop</strong></button><span className="active-app-name">{active?APP_INFO[active].name:'デスクトップ'}</span><button className={launcher?'menu-selected':''} onClick={()=>setLauncher(!launcher)} aria-expanded={launcher}>アプリ</button><button onClick={()=>setHelp(true)}>操作ガイド</button></div><div className="menu-right">{!embedded&&<button className={`usb-button ${status.connected?'is-connected':''}`} onClick={status.connected?disconnect:connect} disabled={pending}><Symbol name="usb"/>{pending?status.message:status.connected?'接続中 · 切断':'USBで接続'}</button>}<MenuClock/></div></header>
  {launcher&&<div className="app-launcher" role="menu" aria-label="アプリ一覧">{APP_IDS.map(id=><button key={id} role="menuitem" onClick={()=>open(id)}><Icon id={id} size={28}/><span>{APP_INFO[id].name}</span>{windows.some(w=>w.id===id)&&<i/>}</button>)}</div>}
  <div className="desktop-icons" aria-label="デスクトップのアプリ">{APP_IDS.map(id=><button key={id} className={`desktop-shortcut ${selected===id?'is-selected':''}`} onClick={()=>setSelected(id)} onDoubleClick={()=>open(id)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();open(id);}}} aria-label={`${APP_INFO[id].name}を開く`} title={`${APP_INFO[id].name} — ダブルクリックで開く`}><Icon id={id}/><span>{APP_INFO[id].name}</span></button>)}</div>
  <p className="desktop-tip">ダブルクリックで開く</p>
  {windows.filter(w=>!w.minimized).map(win=><Window key={win.id} win={win} active={active===win.id} viewport={viewport} onFocus={focus} onMove={move} onClose={close} onMinimize={minimize} onMaximize={maximize}><AppContent id={win.id} apps={apps} dispatch={dispatch} onOpen={open} active={active===win.id}/></Window>)}
  <KnobPanel {...controller} active={active} viewport={viewport} enabled={enabled}/>
  <nav className="dock" aria-label="Dock">{APP_IDS.map(id=><button key={id} onClick={()=>open(id)} className={active===id?'dock-active':''} aria-label={`${APP_INFO[id].name}を開く（Dock）`}><span className="dock-tooltip">{APP_INFO[id].name}</span><Icon id={id} size={54}/><i className={windows.some(w=>w.id===id)?'open-indicator':''}/></button>)}</nav>
  {notice&&<div className="desktop-notice" role="status"><span>{notice}</span><button onClick={clearNotice} aria-label="通知を閉じる"><Symbol name="close"/></button></div>}
  {help&&<Help close={()=>setHelp(false)}/>}
 </main>;
}

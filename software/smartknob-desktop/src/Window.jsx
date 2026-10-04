import React,{useRef} from 'react';
import {APP_INFO} from './model.js';
import {Symbol} from './Icon.jsx';
export default function Window({win,active,viewport,onFocus,onMove,onClose,onMinimize,onMaximize,children}) {
 const drag=useRef(null);
 const rect=win.maximized?{x:12,y:44,width:viewport.width-24,height:viewport.height-148}:win;
 function start(event,kind){
  if(event.button!==0||event.target.closest('button')||win.maximized)return;
  event.currentTarget.setPointerCapture(event.pointerId);drag.current={kind,x:event.clientX,y:event.clientY,rect:{...win}};
 }
 function move(event){
  const d=drag.current;if(!d)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;
  onMove(win.id,d.kind==='move'?{...d.rect,x:d.rect.x+dx,y:d.rect.y+dy}:{...d.rect,width:Math.max(360,d.rect.width+dx),height:Math.max(300,d.rect.height+dy)});
 }
 const end=()=>{drag.current=null;};
 return <section className={`desktop-window ${active?'is-active':''} ${win.maximized?'is-maximized':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height,zIndex:win.z}} onPointerDownCapture={()=>onFocus(win.id)} aria-label={`${APP_INFO[win.id].name} ウィンドウ`} data-window={win.id}>
   <div className="window-titlebar" onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDoubleClick={e=>{if(!e.target.closest('button'))onMaximize(win.id);}}>
    <div className="traffic-lights"><button className="close" title="閉じる" aria-label={`${APP_INFO[win.id].name}を閉じる`} onClick={()=>onClose(win.id)}><Symbol name="close" size={10}/></button><button className="minimize" title="最小化" aria-label={`${APP_INFO[win.id].name}を最小化`} onClick={()=>onMinimize(win.id)}><Symbol name="minus" size={10}/></button><button className="maximize" title="拡大・元に戻す" aria-label={`${APP_INFO[win.id].name}を拡大`} onClick={()=>onMaximize(win.id)}><Symbol name="plus" size={10}/></button></div>
    <h2>{APP_INFO[win.id].name}</h2><span className="window-focus-mark" title={active?'ノブで操作中':''}>{active?<Symbol name="knob" size={13}/>:null}</span>
   </div>
   <div className="window-content">{children}</div>
   {!win.maximized&&<div className="window-resize" aria-hidden="true" onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>}
 </section>;
}

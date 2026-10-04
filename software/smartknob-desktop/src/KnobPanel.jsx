import React,{useEffect,useRef,useState} from 'react';
import Icon,{Symbol} from './Icon.jsx';
import {APP_INFO} from './model.js';

export default function KnobPanel({active,control,status,turn,press,longPress,viewport,enabled=true}) {
 const [compactChoice,setCompact]=useState(null);
 const compact=compactChoice??((viewport?.width??window.innerWidth)<1400||(viewport?.height??window.innerHeight)<850);
 const [pushing,setPushing]=useState(false);
 const dial=useRef(null),drag=useRef(null),hold=useRef(null),fired=useRef(false),target=useRef(active);
 target.current=active;
 useEffect(()=>{
  const node=dial.current;if(!node)return;
  let accumulated=0;
  const wheel=e=>{e.preventDefault();accumulated+=e.deltaY;const steps=Math.trunc(accumulated/24);if(steps){turn(steps);accumulated-=steps*24;}};
  node.addEventListener('wheel',wheel,{passive:false});
  return()=>node.removeEventListener('wheel',wheel);
 },[turn,control?.key,compact]);
 useEffect(()=>{clearTimeout(hold.current);setPushing(false);drag.current=null;fired.current=true;},[control?.key,enabled]);
 useEffect(()=>()=>clearTimeout(hold.current),[]);
 function down(e){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,remainder:0};}
 function move(e){const d=drag.current;if(!d)return;d.remainder+=(e.clientX-d.x-(e.clientY-d.y))/8;d.x=e.clientX;d.y=e.clientY;const steps=Math.trunc(d.remainder);if(steps){turn(steps);d.remainder-=steps;}}
 function pressDown(e){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);fired.current=false;setPushing(true);const id=active;hold.current=setTimeout(()=>{if(id===target.current){fired.current=true;longPress();setPushing(false);}},650);}
 function pressUp(){clearTimeout(hold.current);setPushing(false);if(!fired.current)press();fired.current=true;}
 const magnetic=control&&(control.detents.includes(control.value)||control.favorites.includes(control.value));
 return <aside className={`knob-panel ${compact?'compact':''}`} aria-label="ノブの操作">
  <div className="knob-panel-header"><span><Symbol name="knob"/>ノブの操作</span><button aria-label={compact?'ノブを展開':'ノブをコンパクトにする'} title={compact?'展開':'コンパクト表示'} onClick={()=>setCompact(!compact)}><Symbol name={compact?'plus':'minus'}/></button></div>
  {control?<><div className="knob-context"><Icon id={active} size={44}/><div><p>{APP_INFO[active].name} · {control.label}</p><output aria-live="polite" className="knob-value">{control.valueText}</output></div></div>
  <div className="knob-controls">
   <div ref={dial} className={`virtual-knob ${magnetic?'is-detent':''} ${pushing?'is-pushed':''}`} onPointerDown={down} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} role="slider" tabIndex={0} aria-label={`${APP_INFO[active].name}のノブ`} aria-valuenow={control.value} aria-valuemin={control.min} aria-valuemax={control.max} aria-valuetext={control.valueText}>
    <svg className="dial-ticks" viewBox="0 0 200 200" aria-hidden="true">{Array.from({length:36},(_,i)=><line key={i} x1="100" y1={i%3===0?'8':'12'} x2="100" y2="18" transform={`rotate(${i*10} 100 100)`} stroke={i%3===0?'#8791a3':'#bcc4d1'} strokeWidth={i%3===0?1.8:1}/>)}</svg>
    <div className="metal-dial"><i style={{transform:`rotate(${(control.value*control.width)%360}deg)`}}/></div>
   </div>
   <div className="knob-buttons"><button aria-label="ノブを左へ1目盛り" title="左へ1目盛り" onClick={()=>turn(-1)}><Symbol name="minus"/></button><button className="press-knob" aria-label="ノブを押す" title={`押す：${control.pressHint}${control.longPressHint?` / 長押し：${control.longPressHint}`:''}`} onPointerDown={pressDown} onPointerUp={pressUp} onPointerCancel={()=>{clearTimeout(hold.current);fired.current=true;setPushing(false);}} onClick={e=>{if(e.detail===0)press();}}>押す</button><button aria-label="ノブを右へ1目盛り" title="右へ1目盛り" onClick={()=>turn(1)}><Symbol name="plus"/></button></div>
  </div>
  <p className="feel-hint"><span className={magnetic?'at-detent':''}/>{control.hint}</p>
  {!compact&&<><div className="knob-actions"><span>押す</span><b>{control.pressHint}</b>{control.longPressHint&&<><button onClick={longPress}>長押し</button><b>{control.longPressHint}</b></>}</div><p className="knob-key-hint">← → 回す · Space 押す<br/><span>長押しは実機で2回押し</span></p></>}
  </>:<div className="knob-empty"><Symbol name="knob" size={48}/><p>ウィンドウを選択してください。</p></div>}
  <div className="knob-status"><span className={status.connected?'connected-dot':'simulation-dot'}/>{status.connected?'SmartKnob 接続中':'画面上で操作できます'}</div>
 </aside>;
}

import React, {useId} from 'react';

const colors={browser:['#50caff','#1454ec'],windows:['#42c8ff','#1269ed'],timer:['#ffa533','#ff721e'],photo:['#ffffff','#f0f1f4'],video:['#be83ff','#8049ef'],music:['#ff88ad','#ee3976'],audio:['#31d8d4','#00a7b1'],lights:['#ffdb55','#f5ad17'],review:['#6f87ff','#334eff'],reader:['#ffaf6d','#ff762e'],map:['#7bdd74','#26b950'],input:['#57c5ff','#188be9']};
function Glyph({id}) {
  switch(id){
    case 'browser':return <><circle cx="32" cy="32" r="24" fill="white" opacity=".95"/><circle cx="32" cy="32" r="20" fill="#168ded"/><path d="M45 18 36 36 19 46 28 28Z" fill="white"/><path d="m45 18-9 18-8-8Z" fill="#ff5149"/></>;
    case 'windows':return <g fill="none" stroke="white" strokeWidth="2.3"><rect x="15" y="15" width="28" height="28" rx="3"/><rect x="23" y="23" width="27" height="28" rx="3"/><path d="M15 22h28M23 30h27" opacity=".7"/></g>;
    case 'timer':return <g stroke="white" fill="none" strokeWidth="3" strokeLinecap="round"><circle cx="32" cy="32" r="21"/><path d="M32 17v16l11 7"/></g>;
    case 'photo':return <g transform="translate(32 32)">{['#ffcb39','#f39439','#ee6580','#b578c4','#6496e0','#5fc3d4','#60b975','#b8ca58'].map((c,i)=><ellipse key={c} cx="0" cy="-11" rx="8.8" ry="15.5" fill={c} opacity=".85" transform={`rotate(${i*45})`}/>)}<circle r="5" fill="#ffca45" opacity=".6"/></g>;
    case 'video':return <><rect x="14" y="17" width="36" height="31" rx="7" fill="white"/><path d="m27 24 14 9-14 9Z" fill="#a064f5"/></>;
    case 'music':return <><path d="M27 40V19l22-5v25M27 25l22-5" fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round"/><ellipse cx="21.5" cy="43" rx="8" ry="6" fill="white" transform="rotate(-20 21.5 43)"/><ellipse cx="43.5" cy="42" rx="8" ry="6" fill="white" transform="rotate(-20 43.5 42)"/></>;
    case 'audio':return <g stroke="white" strokeWidth="3.5" strokeLinecap="round"><path d="M14 20h36M14 32h36M14 44h36"/><circle cx="24" cy="20" r="4" fill="white"/><circle cx="41" cy="32" r="4" fill="white"/><circle cx="28" cy="44" r="4" fill="white"/></g>;
    case 'lights':return <><path d="M32 12a14 14 0 0 0-10 24c3 3 4 6 4 9h12c0-3 1-6 4-9a14 14 0 0 0-10-24Z" fill="white"/><path d="M26 49h12M28 53h8" stroke="white" strokeWidth="3" strokeLinecap="round"/></>;
    case 'review':return <g fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m24 20-12 12 12 12m16-24 12 12-12 12"/></g>;
    case 'reader':return <><path d="M11 17q11-4 19 2v30q-9-6-19-2ZM53 17q-11-4-19 2v30q9-6 19-2Z" fill="white"/><path d="M32 21v29" stroke="white" strokeWidth="2"/></>;
    case 'map':return <><path d="m12 20 13-6 14 6 13-6v31l-13 6-14-6-13 6Z" fill="white"/><path d="M25 17v25m14-19v25" stroke="#5dcc6d" strokeWidth="2"/></>;
    case 'input':return <g fill="none" stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><path d="m13 19 3 3 6-7m-9 18 3 3 6-7m-9 18 3 3 6-7M29 19h22M29 33h22M29 47h22"/></g>;
    default:return <circle cx="32" cy="32" r="15" fill="none" stroke="white" strokeWidth="3"/>;
  }
}
export default function Icon({id,size=64,className=''}){
 const uid=useId().replace(/:/g,''); const palette=colors[id]||colors.windows;
 return <svg className={`app-icon ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id={uid} x2=".2" y2="1"><stop stopColor={palette[0]}/><stop offset="1" stopColor={palette[1]}/></linearGradient></defs><rect x="1" y="1" width="62" height="62" rx="14" fill={`url(#${uid})`} stroke="white" strokeOpacity=".26"/><Glyph id={id}/></svg>;
}
export function Symbol({name,size=16,...props}) {
 const paths={close:'m5 5 10 10M15 5 5 15',minus:'M4 10h12',plus:'M4 10h12M10 4v12',maximize:'M4 8V4h4m4 0h4v4m0 4v4h-4m-4 0H4v-4',chevron:'m7 4 6 6-6 6',usb:'M10 3v11m0-11-2 3m2-3 2 3m-6 3v3l4 2m4-8v5l-4 3m0 0v3',help:'M7 7a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',grid:'M4 4h4v4H4Zm8 0h4v4h-4ZM4 12h4v4H4Zm8 0h4v4h-4Z',knob:'M10 3a7 7 0 1 0 7 7 7 7 0 0 0-7-7Zm0 0v4'};
 return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.knob}/></svg>;
}

export const WINDOW_SIZES={photo:[880,590],timer:[330,340],browser:[790,540],windows:[630,530],video:[800,570],music:[610,520],audio:[590,470],lights:[650,520],review:[810,600],reader:[790,570],map:[760,550],input:[570,500]};
export function fitRect(rect,viewport){
 const width=Math.min(Math.max(300,rect.width),viewport.width-24),height=Math.min(Math.max(240,rect.height),viewport.height-160);
 return {...rect,width,height,x:Math.max(12,Math.min(rect.x,viewport.width-width-12)),y:Math.max(44,Math.min(rect.y,viewport.height-height-108))};
}
export function initialRect(id,viewport,index=0){
 const [defaultWidth,defaultHeight]=WINDOW_SIZES[id]||[700,520];
 const width=id==='photo'?Math.min(defaultWidth,Math.max(620,viewport.width-560)):defaultWidth;
 const height=id==='timer'?Math.min(defaultHeight,viewport.height<850?326:340):defaultHeight;
 return fitRect({width,height,x:id==='timer'?viewport.width-380:Math.min(248,viewport.width*.16)+index*20,y:id==='timer'?65:98+index*18},viewport);
}
export function initialWindows(viewport){return [
 {id:'timer',...initialRect('timer',viewport),z:1,minimized:false,maximized:false},
 {id:'photo',...initialRect('photo',viewport),z:2,minimized:false,maximized:false}
];}
export function topWindow(windows){return [...windows].filter(w=>!w.minimized).sort((a,b)=>b.z-a.z)[0]?.id??null;}

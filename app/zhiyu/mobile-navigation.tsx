'use client';
/* eslint-disable next/no-img-element */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {CalendarCheck,Compass,MessageSquare,Users} from 'lucide-react';
import type {Page,Person} from './data';
import {bounceMobileIcon} from './mobile-effects';

const keys:Page[]=['chat','contacts','tasks','moments','me'];
const labels=['消息','通讯录','任务','动态','我'];
export default function MobileNavigation({page,self,unread,tasks,moments,hidden,onNavigate}:{page:Page;self:Person;unread:number;tasks:boolean;moments:boolean;hidden:boolean;onNavigate:(page:Page)=>void}) {
 const [scrollState,setScrollState]=useState({page,hidden,collapsed:false}),[flow,setFlow]=useState<{from:number;to:number;key:number}|null>(null);
 if(scrollState.page!==page||scrollState.hidden!==hidden)setScrollState({page,hidden,collapsed:false});
 const collapsed=scrollState.page===page&&scrollState.hidden===hidden&&scrollState.collapsed;
 const nav=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(hidden)return;
  const root=nav.current?.closest('main.zy-mobile');
  if(!root)return;
  const setCollapsed=(value:boolean)=>setScrollState(old=>old.page===page&&old.hidden===hidden&&old.collapsed===value?old:{page,hidden,collapsed:value});
  const last=new WeakMap<HTMLElement,number>(),intents=new WeakMap<HTMLElement,{at:number;direction:number}>();
  let touch:{node:HTMLElement;y:number}|null=null;
  const scroller=(target:EventTarget|null)=>{
   if(!(target instanceof Element)||!root.contains(target)||target.closest('dialog,.zy-mobile-detail-page'))return null;
   let node:HTMLElement|null=target instanceof HTMLElement?target:target.parentElement;
   while(node&&node!==root){
    if(node.scrollHeight>node.clientHeight+1&&/^(auto|scroll)$/.test(getComputedStyle(node).overflowY))return node;
    node=node.parentElement;
   }
   return null;
  };
  const intend=(node:HTMLElement,direction=0)=>{if(!last.has(node))last.set(node,node.scrollTop);intents.set(node,{at:performance.now(),direction});};
  const wheel=(e:WheelEvent)=>{if(!e.isTrusted||Math.abs(e.deltaY)<Math.abs(e.deltaX))return;const node=scroller(e.target);if(node)intend(node,Math.sign(e.deltaY));};
  const touchStart=(e:TouchEvent)=>{const node=scroller(e.target);touch=node&&e.touches[0]?{node,y:e.touches[0].clientY}:null;};
  const touchMove=(e:TouchEvent)=>{if(!e.isTrusted||!touch||!e.touches[0])return;const y=e.touches[0].clientY;if(Math.abs(y-touch.y)>2){intend(touch.node,Math.sign(touch.y-y));touch.y=y;}};
  const pointer=(e:PointerEvent)=>{const node=scroller(e.target);if(!e.isTrusted||!node||e.pointerType==='touch')return;const box=node.getBoundingClientRect();if(e.clientX>=box.right-16)intend(node);};
  const key=(e:KeyboardEvent)=>{if(!e.isTrusted||!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)||(e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable="true"],button')))return;const node=scroller(e.target);if(node)intend(node,['ArrowUp','PageUp','Home'].includes(e.key)||e.key===' '&&e.shiftKey?-1:1);};
  const scroll=(e:Event)=>{
   const node=e.target;if(!(node instanceof HTMLElement)||!root.contains(node)||node.closest('dialog,.zy-mobile-detail-page'))return;
   const before=last.get(node),intent=intents.get(node);last.set(node,node.scrollTop);
   // Browser restoration, focus, message autoscroll and layout changes are not swipes.
   if(!intent||performance.now()-intent.at>1200)return;
   const delta=before===undefined?0:node.scrollTop-before;
   // Compositor scrolling can already be applied before a passive wheel is
   // delivered. Its genuine input direction still identifies this gesture.
   if(node.scrollTop<24||delta<-2||Math.abs(delta)<=2&&intent.direction<0)setCollapsed(false);else if(delta>2||intent.direction>0)setCollapsed(true);
  };
  document.addEventListener('wheel',wheel,{capture:true,passive:true});
  document.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',touchMove,{capture:true,passive:true});
  document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',key,true);document.addEventListener('scroll',scroll,true);
  return()=>{document.removeEventListener('wheel',wheel,true);document.removeEventListener('touchstart',touchStart,true);document.removeEventListener('touchmove',touchMove,true);document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',key,true);document.removeEventListener('scroll',scroll,true);};
 },[page,hidden]);
 useEffect(()=>{if(!flow)return;const timer=setTimeout(()=>setFlow(null),400);return()=>clearTimeout(timer);},[flow]);
 if(hidden)return null;
 const select=(next:Page)=>{const element=nav.current;if(element&&next!==page){const buttons=element.querySelectorAll<HTMLButtonElement>('button'),box=element.getBoundingClientRect(),a=buttons[keys.indexOf(page)]?.getBoundingClientRect(),b=buttons[keys.indexOf(next)]?.getBoundingClientRect();if(a&&b)setFlow({from:a.x+a.width/2-box.x-15,to:b.x+b.width/2-box.x-15,key:(flow?.key||0)+1});}onNavigate(next);};
 return <nav ref={nav} className={'zy-mobile-nav'+(collapsed?' is-collapsed':'')} aria-label="主导航">
  {flow&&<i key={flow.key} className="zy-mobile-nav-flow" aria-hidden="true" style={{'--zy-m-nav-from':flow.from+'px','--zy-m-nav-to':flow.to+'px'} as CSSProperties}/>}
  <div className="zy-mobile-nav-items">{keys.map((key,i)=>{const active=key===page,notice=key==='chat'&&unread>0?`${unread}条未读消息`:key==='tasks'&&tasks?'有正在进行的任务':key==='moments'&&moments?'有新动态':'';const Icon=[MessageSquare,Users,CalendarCheck,Compass][i];return <button type="button" key={key} data-nav-key={key} className={active?'is-active':''} aria-label={labels[i]+(notice?'，'+notice:'')} aria-current={active?'page':undefined} onClick={event=>{bounceMobileIcon(event.currentTarget);select(key);}}>
   {key==='me'?<span className="zy-mobile-nav-avatar" data-mobile-bounce-icon>{self.avatar?<img src={self.avatar} alt=""/>:<span>{(self.nickname||self.name).slice(0,1)}</span>}</span>:<Icon size={24} strokeWidth={1.8} fill={active?'currentColor':'none'}/>}
   {key==='chat'&&unread>0&&<span key={unread} className="zy-mobile-nav-unread">{unread>99?'99+':unread}</span>}
   {(key==='tasks'&&tasks||key==='moments'&&moments)&&<i className="zy-mobile-nav-dot"/>}
  </button>;})}</div>
 </nav>;
}

'use client';

import {useEffect} from 'react';
import {criticalScrollStep} from './scroll-spring';
import './spring-scroll.css';

type Motion={node:HTMLElement;position:number;velocity:number;target:number;written:number;at:number;inputAt:number;previousTranslate:string;previousBehavior:string;dragging:boolean};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const scope='.zy-app,.zy-auth-stage,.zy-dialog,.zy-mobile-detail-page,.image-viewer,.viewer-forward,.zy-task-history,.zy-task-history-details,.zy-realtime-page';

/** Enhances only user gestures. Programmatic history restoration, chat
 * autoscroll, focus and keyboard editing continue to use their own positions. */
export default function SpringScroll() {
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const motions=new Map<HTMLElement,Motion>();
  let frame=0,touch:{node:HTMLElement;x:number;y:number;at:number;vertical:boolean;velocity:number}|null=null;
  const maximum=(node:HTMLElement)=>Math.max(0,node.scrollHeight-node.clientHeight);
  const restore=(motion:Motion)=>{
   motion.node.classList.remove('zy-spring-scrolling');
   motion.node.style.removeProperty('--zy-scroll-edge-offset');
   if(motion.previousTranslate)motion.node.style.translate=motion.previousTranslate;
   else motion.node.style.removeProperty('translate');
   if(motion.previousBehavior)motion.node.style.scrollBehavior=motion.previousBehavior;
   else motion.node.style.removeProperty('scroll-behavior');
   motions.delete(motion.node);
  };
  const stop=(node:HTMLElement)=>{const motion=motions.get(node);if(motion)restore(motion);};
  const find=(target:EventTarget|null)=>{
   if(!(target instanceof Element)||!target.closest(scope))return null;
   let node:HTMLElement|null=target instanceof HTMLElement?target:target.parentElement;
   while(node&&node!==document.body){
    if(maximum(node)>1&&/^(auto|scroll)$/.test(getComputedStyle(node).overflowY))return node;
    node=node.parentElement;
   }
   return null;
  };
  const state=(node:HTMLElement)=>{
   let motion=motions.get(node);
   if(motion&&Math.abs(node.scrollTop-motion.written)>2){restore(motion);motion=undefined;}
   if(!motion){motion={node,position:node.scrollTop,velocity:0,target:node.scrollTop,written:node.scrollTop,at:performance.now(),inputAt:0,previousTranslate:node.style.translate,previousBehavior:node.style.scrollBehavior,dragging:false};motions.set(node,motion);node.style.scrollBehavior='auto';}
   return motion;
  };
  const paint=(motion:Motion)=>{
   const max=maximum(motion.node),position=clamp(motion.position,0,max);
   motion.node.scrollTop=position;motion.written=motion.node.scrollTop;
   const edge=clamp((position-motion.position)*.36,-10,10);
   if(Math.abs(edge)>.04){motion.node.classList.add('zy-spring-scrolling');motion.node.style.setProperty('--zy-scroll-edge-offset',edge.toFixed(3)+'px');motion.node.style.translate='0 var(--zy-scroll-edge-offset)';}
   else{motion.node.classList.remove('zy-spring-scrolling');motion.node.style.removeProperty('--zy-scroll-edge-offset');if(motion.previousTranslate)motion.node.style.translate=motion.previousTranslate;else motion.node.style.removeProperty('translate');}
  };
  const tick=(now:number)=>{
   frame=0;
   for(const motion of motions.values()){
    if(!motion.node.isConnected||media.matches){restore(motion);continue;}
    // An application-owned scroll (e.g. returning to a saved message) wins.
    if(Math.abs(motion.node.scrollTop-motion.written)>2){restore(motion);continue;}
    if(motion.dragging){motion.at=now;continue;}
    motion.target=clamp(motion.target,0,maximum(motion.node));
    const next=criticalScrollStep(motion.position,motion.velocity,motion.target,clamp((now-motion.at)/1000,0,.05));
    motion.position=next.position;motion.velocity=next.velocity;motion.at=now;paint(motion);
    if(Math.abs(motion.position-motion.target)<.15&&Math.abs(motion.velocity)<2){motion.node.scrollTop=motion.target;restore(motion);}
   }
   if([...motions.values()].some(motion=>!motion.dragging))frame=requestAnimationFrame(tick);
  };
  const start=()=>{if(!frame)frame=requestAnimationFrame(tick);};
  const wheel=(event:WheelEvent)=>{
   if(media.matches||event.defaultPrevented||event.ctrlKey||event.shiftKey||!event.isTrusted||Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
   const node=find(event.target);if(!node||!event.cancelable)return;
   event.preventDefault();
   const motion=state(node),now=performance.now(),max=maximum(node);
   const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight*.9:1);
   const elapsed=motion.inputAt?clamp(now-motion.inputAt,8,90):32;
   const velocity=clamp(delta/elapsed*1000,-4000,4000);
   motion.velocity=motion.velocity*.35+velocity*.65;
   if(motion.target<=0&&delta<0||motion.target>=max&&delta>0)motion.velocity=clamp(motion.velocity,-600,600);
   motion.target=clamp(motion.target+delta,0,max);motion.inputAt=now;motion.at=now;start();
  };
  const touchStart=(event:TouchEvent)=>{
   if(media.matches||!event.isTrusted||event.touches.length!==1||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
   const node=find(event.target),point=event.touches[0];if(!node)return;
   stop(node);touch={node,x:point.clientX,y:point.clientY,at:performance.now(),vertical:false,velocity:0};
  };
  const touchMove=(event:TouchEvent)=>{
   if(media.matches||!touch||event.touches.length!==1||!event.isTrusted)return;
   const point=event.touches[0],delta=touch.y-point.clientY,dx=point.clientX-touch.x;
   if(!touch.vertical){if(Math.abs(dx)>Math.abs(delta)){touch=null;return;}if(Math.abs(delta)<2)return;touch.vertical=true;}
   if(!event.cancelable)return;event.preventDefault();
   const now=performance.now(),motion=state(touch.node),max=maximum(touch.node);
   touch.velocity=touch.velocity*.35+clamp(delta/Math.max(8,now-touch.at)*1000,-4000,4000)*.65;
   motion.dragging=true;motion.position+=delta;
   if(motion.position<0)motion.position=Math.max(-28,motion.position*.6);
   else if(motion.position>max)motion.position=max+Math.min(28,(motion.position-max)*.6);
   motion.target=clamp(motion.position,0,max);motion.velocity=touch.velocity;paint(motion);
   touch.y=point.clientY;touch.x=point.clientX;touch.at=now;
  };
  const touchEnd=()=>{
   if(!touch)return;
   const motion=motions.get(touch.node);
   if(motion){motion.dragging=false;motion.at=performance.now();if(motion.at-touch.at>100)motion.velocity=0;motion.target=clamp(motion.position+motion.velocity*.14,0,maximum(motion.node));start();}
   touch=null;
  };
  const key=(event:KeyboardEvent)=>{
   if(media.matches||event.defaultPrevented||event.altKey||event.metaKey||event.ctrlKey||!event.isTrusted||event.target instanceof Element&&event.target.closest('input,textarea,select,button,[contenteditable="true"]'))return;
   const node=find(event.target);if(!node)return;
   const motion=state(node),page=node.clientHeight*.85;
   const values:Record<string,number>={ArrowDown:42,ArrowUp:-42,PageDown:page,PageUp:-page,' ':event.shiftKey?-page:page};
   const delta=values[event.key];if(delta===undefined&&!['Home','End'].includes(event.key)){if(!motion.velocity&&motion.position===motion.target)restore(motion);return;}
   event.preventDefault();motion.target=event.key==='Home'?0:event.key==='End'?maximum(node):clamp(motion.target+delta,0,maximum(node));motion.at=performance.now();start();
  };
  const pointer=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const node=find(event.target);if(node)stop(node);};
  const reset=()=>{for(const motion of motions.values())restore(motion);touch=null;if(frame)cancelAnimationFrame(frame);frame=0;};
  document.addEventListener('wheel',wheel,{capture:true,passive:false});
  document.addEventListener('touchstart',touchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',touchMove,{capture:true,passive:false});
  document.addEventListener('touchend',touchEnd,true);document.addEventListener('touchcancel',touchEnd,true);
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',pointer,true);media.addEventListener('change',reset);
  return()=>{reset();document.removeEventListener('wheel',wheel,true);document.removeEventListener('touchstart',touchStart,true);document.removeEventListener('touchmove',touchMove,true);document.removeEventListener('touchend',touchEnd,true);document.removeEventListener('touchcancel',touchEnd,true);document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',pointer,true);media.removeEventListener('change',reset);};
 },[]);
 return null;
}

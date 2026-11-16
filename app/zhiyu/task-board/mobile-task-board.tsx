'use client';
/* eslint-disable next/no-img-element -- Keep the existing account-scoped avatar assets. */

import {useMemo, useState, type CSSProperties, type RefObject} from 'react';
import {Activity, CalendarDays, Check, ClipboardList, CookingPot, Droplet, Dumbbell, HeartPulse, Moon, PersonStanding, ShoppingBag, Utensils, type LucideIcon} from 'lucide-react';
import {useAccount} from '../auth-gate';
import {LoadingSkeleton} from '../loading-state';
import {MobileSubmitButton,useMobileFirstEntry} from '../mobile-effects';
import {reportUserFacingError} from '../../../lib/user-facing-errors';
import {trainingTitlePresentation} from '../../../lib/npc/training-task-presentation';
import {categories, npcs} from './config';
import HistoryView from './history-view';
import {boardSelectedDate, boardTimerRemainingSeconds, canOperateBoardTask, isTaskFinished, shiftBoardDate} from './reducer';
import {TaskExpand, type TaskActions} from './task-components';
import type {Category, Npc, Task, TaskBoardModel, TaskView} from './types';
import type {useTaskBoard} from './use-task-board';
import './mobile-task-board.css';

type Props={
  board:ReturnType<typeof useTaskBoard>;
  actions:TaskActions;
  onOpenConversation:(npcId:string,task?:Task)=>void;
  scrollRef:RefObject<HTMLElement|null>;
};
const icons:Record<string,LucideIcon>={Activity,ClipboardList,CookingPot,Droplet,Dumbbell,HeartPulse,Moon,PersonStanding,ShoppingBag,Utensils};
const dateLabel=(date:string)=>`${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'}).format(new Date(date+'T12:00:00+08:00'))}`;
const clock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
const titleFor=(task:Task)=>trainingTitlePresentation(task.title,['fitness','recovery'].includes(task.categoryId)).title;
const categoryFor=(task:Task):Category=>categories.find(category=>category.id===task.categoryId)||{id:task.categoryId,name:'任务',groupId:'',icon:'ClipboardList',color:'var(--zy-m-muted)'};
const npcFor=(task:Task)=>npcs.find(npc=>npc.id===task.npcId);
const taskColor=(task:Task):CSSProperties=>({'--zy-m-task-color':categoryFor(task).color} as CSSProperties);
const rowOrder=(a:Task,b:Task)=>{
  if(a.appendOrder!==undefined||b.appendOrder!==undefined)return a.appendOrder===undefined?-1:b.appendOrder===undefined?1:a.appendOrder-b.appendOrder;
  return Number(!!b.pinned)-Number(!!a.pinned)||a.order-b.order;
};

function TaskAvatar({npc,size=22}:{npc?:Npc;size?:number}) {
  if(!npc)return null;
  return <span className="zy-m-task-avatar" style={{width:size,height:size}} aria-label={npc.name} title={npc.name}>{npc.avatar?<img src={npc.avatar} alt=""/>:(npc.initial||npc.name.slice(0,1))}</span>;
}
function TaskCategory({task,completed=false}:{task:Task;completed?:boolean}) {
  const category=categoryFor(task),Icon=icons[category.icon]||ClipboardList;
  return <span className={'zy-m-task-category'+(completed?' is-completed':'')} aria-label={category.name}><Icon size={15} strokeWidth={1.6}/></span>;
}

export default function MobileTaskBoard({board,actions,onOpenConversation,scrollRef}:Props) {
  return <MobileTaskBoardView key={board.model.page.view} board={board} actions={actions} onOpenConversation={onOpenConversation} scrollRef={scrollRef}/>;
}
function MobileTaskBoardView({board,actions,onOpenConversation,scrollRef}:Props) {
  const {account}=useAccount();
  const {dispatch,ready,storageError,now}=board;
  const [heldModel,setHeldModel]=useState<TaskBoardModel|null>(null),[submitError,setSubmitError]=useState('');
  const model=heldModel||board.model;
  async function commitFinish(task:Task){setHeldModel(board.model);setSubmitError('');await board.commitAction({type:task.type==='count'?'complete-count':'toggle-status',taskId:task.id,now:Date.now()});}
  function completeSubmission(){setHeldModel(null);}
  function failSubmission(error:unknown){setHeldModel(null);setSubmitError(reportUserFacingError(error,'save','保存任务状态'));}
  const mobileActions:TaskActions={...actions,onCommitFinish:commitFinish,onCommitComplete:completeSubmission,onCommitError:failSubmission,submissionPending:!!heldModel};
  const {view}=model.page;
  const animateRows=useMobileFirstEntry(account.id+':mobile-tasks:'+view);
  const selectedDate=boardSelectedDate(model),isToday=selectedDate===model.today;
  const dayTasks=model.tasks.filter(task=>task.date===selectedDate);
  const active=dayTasks.find(task=>task.id===model.page.activeTaskId&&!isTaskFinished(task));
  const done=dayTasks.filter(isTaskFinished).length,remaining=dayTasks.length-done;
  const progress=dayTasks.length?Math.round(done/dayTasks.length*100):0;
  const pending=dayTasks.filter(task=>!isTaskFinished(task)&&task.id!==active?.id).sort(rowOrder);
  const completed=dayTasks.filter(isTaskFinished).sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||''));
  const plans=model.plans||[];
  const futureEnd=shiftBoardDate(model.today,model.page.futureRange);
  const futureDays=useMemo(()=>{
    const days=new Map<string,Task[]>();
    for(const task of model.tasks){if(task.date<=model.today||task.date>futureEnd)continue;const tasks=days.get(task.date)||[];tasks.push(task);days.set(task.date,tasks);}
    return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,tasks])=>({date,tasks:tasks.sort(rowOrder)}));
  },[model.tasks,model.today,futureEnd]);
  // Mobile summaries and calendars always derive from the supplied records.
  // Legacy sample aggregate metadata must not invent completed calendar days.
  const historyModel=useMemo(()=>({...model,demoOverview:undefined,page:{...model.page,categoryFilter:undefined}}),[model]);
  function selectView(next:TaskView) {
    if(next==='today'&&!isToday)dispatch({type:'set-selected-date'});
    dispatch({type:'set-view',view:next});
    scrollRef.current?.scrollTo({top:0});
  }
  function detail(task:Task,mode:TaskView,activeTask=false) {
    const npc=npcFor(task)||{id:task.npcId,name:'智友',avatar:''};
    return <TaskExpand task={task} category={categoryFor(task)} npc={npc} mode={mode} expanded expandedStepId={model.page.expandedStepId} active={activeTask} now={now} rest={model.rest} timers={model.timers} today={selectedDate} canOperate={mode==='today'?canOperateBoardTask(model,task):false} actions={mobileActions} mobile/>;
  }
  function row(task:Task,mode:TaskView,index=0) {
    const finished=isTaskFinished(task),expanded=model.page.expandedTaskIds.includes(task.id);
    const canOperate=mode==='history'||mode==='today'&&canOperateBoardTask(model,task);
    const count=task.count;
    const progressText=!finished&&count?`${count.current} / ${count.target}${count.unit}`:'';
    const note=[task.amount,task.tip,progressText].filter(Boolean).join(' · ');
    const actionLabel=mode==='future'?'未来任务，暂不可完成：':finished?'取消完成：':task.type==='steps'?'结束任务：':count?`记一次 ${count.perTime}${count.unit}：`:'完成：';
    return <article key={task.id} className={'zy-m-task-row'+(finished?' is-completed':'')+(animateRows?' zy-m-task-enter':'')} style={{...taskColor(task),animationDelay:`${Math.min(index,11)*35}ms`}} data-task-id={task.id}>
      <div className="zy-m-task-row-main">
        <TaskCategory task={task} completed={finished}/>
        <button type="button" className="zy-m-task-row-copy" aria-expanded={expanded} aria-controls={'zy-m-task-detail-'+task.id} onClick={()=>actions.onExpandTask(task)}>
          <span className="zy-m-task-name">{titleFor(task)}</span>
          {note&&<span className="zy-m-task-note">{note}</span>}
        </button>
        <TaskAvatar npc={npcFor(task)}/>
        <button type="button" className={'zy-m-task-check'+(finished?' is-completed':'')} aria-label={actionLabel+titleFor(task)} aria-pressed={finished} disabled={!canOperate||!!heldModel} onClick={()=>actions.onToggleStatus(task)}><span>{finished&&<Check size={10} strokeWidth={2.6}/>}</span></button>
      </div>
      {expanded&&<div id={'zy-m-task-detail-'+task.id} className="zy-m-task-detail">{detail(task,mode)}</div>}
    </article>;
  }
  function activeCard(task:Task) {
    const steps=task.steps||[],currentIndex=steps.findIndex(step=>!step.done&&!step.skipped),current=steps[currentIndex];
    const rest=model.rest?.taskId===task.id?model.rest:undefined;
    const timer=current?model.timers[`${task.id}:${current.id}`]:undefined;
    const remainingSeconds=boardTimerRemainingSeconds(rest||timer,now);
    const subtitle=current?`第 ${currentIndex+1}/${steps.length} 步 · ${current.name}`:steps.length?`已完成 ${steps.filter(step=>step.done).length}/${steps.length} 步`:task.amount;
    const expanded=model.page.activeExpanded;
    const category=categoryFor(task),verb=category.verb||'执行';
    const statusText=rest?'组间休息':timer?'计时':task.status==='paused'?'已暂停':'进行中';
    return <section className="zy-m-task-section" aria-label="进行中"><h2>进行中</h2><article className={'zy-m-task-active'+(animateRows?' zy-m-task-enter':'')} style={taskColor(task)} data-active-task-id={task.id}>
      <div className="zy-m-task-active-heading"><TaskCategory task={task}/><button type="button" className="zy-m-task-active-copy" aria-expanded={expanded} aria-controls={'zy-m-task-active-detail-'+task.id} onClick={()=>dispatch({type:'toggle-active-expanded'})}><strong>{titleFor(task)}</strong>{subtitle&&<span>{subtitle}</span>}</button><TaskAvatar npc={npcFor(task)} size={24}/></div>
      {!!steps.length&&<div className="zy-m-task-steps" aria-label={`已完成 ${steps.filter(step=>step.done).length} / ${steps.length} 步`}>{steps.map((step,index)=><span key={step.id} className={step.done?'is-completed':index===currentIndex?'is-current':''}/>)}</div>}
      <div className="zy-m-task-active-footer"><span>{statusText}{(rest||timer)&&<strong>{clock(remainingSeconds)}</strong>}</span><div>{task.type==='steps'?<button type="button" className="zy-m-task-end" disabled={!canOperateBoardTask(model,task)} onClick={()=>actions.onFinish(task)}>结束</button>:<MobileSubmitButton disabled={!canOperateBoardTask(model,task)||!!heldModel} onSubmit={()=>commitFinish(task)} onComplete={completeSubmission} onError={failSubmission}>结束</MobileSubmitButton>}<button type="button" className="zy-m-task-continue" disabled={!canOperateBoardTask(model,task)} onClick={()=>{if(task.status==='paused')actions.onStart(task);if(!expanded)dispatch({type:'toggle-active-expanded'});}}>继续{verb}</button></div></div>
      {expanded&&<div id={'zy-m-task-active-detail-'+task.id} className="zy-m-task-detail">{detail(task,'today',true)}</div>}
    </article></section>;
  }
  return <div className="zy-task-board zy-m-task-board" data-task-view={view} aria-label="任务">
    <header className="zy-m-task-header"><h1>任务</h1><button type="button" aria-label="打开历史任务日历" onClick={()=>selectView('history')}><CalendarDays size={22} strokeWidth={1.6}/></button></header>
    <section ref={scrollRef} className="zy-m-task-scroll" data-mobile-scroll aria-label={view==='today'?'今天的任务':view==='future'?'未来的任务':'任务历史'} aria-busy={!ready}>
      <div className="zy-m-task-tabs" role="tablist" aria-label="任务视图">{([{id:'today',label:'今天'},{id:'future',label:'未来'},{id:'history',label:'历史'}] as const).map(item=><button type="button" key={item.id} role="tab" aria-selected={view===item.id} onClick={()=>selectView(item.id)}>{item.label}</button>)}</div>
      {!ready&&<LoadingSkeleton label="正在读取任务" rows={4}/>}
      {(storageError||submitError)&&<p className="zy-m-task-error" role="alert">{storageError||submitError}</p>}
      {ready&&view==='today'&&<>
        <section className="zy-m-task-day" aria-label="任务进度"><div className="zy-m-task-day-copy"><h2>{dateLabel(selectedDate)}</h2><p>{dayTasks.length?`还剩 ${remaining} 项`:isToday?'今天还没安排任务':'这天还没安排任务'}{!isToday&&<button type="button" onClick={()=>dispatch({type:'set-selected-date'})}>返回今天</button>}</p></div><strong className="zy-m-task-percent">{progress}<small>%</small></strong><div className="zy-m-task-progress"><progress className="zy-m-task-progress-semantic" aria-label="任务完成进度" value={progress} max={100}/><span style={{width:progress+'%'}}/></div></section>
        {!!plans.length&&<section className="zy-m-task-section" aria-label="我的计划"><h2>我的计划</h2><div className="zy-m-task-plans">{plans.map(plan=><article className="zy-m-task-plan" key={plan.id} style={{'--zy-m-task-color':plan.color} as CSSProperties}><strong>{plan.name}</strong><span>{plan.progressText}</span><div><i style={{width:Math.max(0,Math.min(1,plan.progress))*100+'%'}}/></div></article>)}</div></section>}
        {active&&activeCard(active)}
        {!!pending.length&&<section className="zy-m-task-section" aria-label="待完成"><h2>待完成 · {pending.length}</h2>{pending.map((task,index)=>row(task,'today',index))}</section>}
        {!!completed.length&&<section className="zy-m-task-section" aria-label="已完成"><h2>已完成 · {completed.length}</h2>{completed.map((task,index)=>row(task,'today',pending.length+index))}</section>}
        {!dayTasks.length&&<div className="zy-m-task-empty">{isToday?'Molly：今天还没安排，要不要说说你想做什么？':'这天还没有安排任务'}</div>}
      </>}
      {ready&&view==='future'&&<>
        <div className="zy-m-task-future-heading"><span>{dateLabel(shiftBoardDate(model.today,1))} 起</span><fieldset aria-label="未来日期范围">{([7,30] as const).map(range=><button type="button" key={range} aria-pressed={model.page.futureRange===range} onClick={()=>dispatch({type:'set-future-range',range})}>{range} 天</button>)}</fieldset></div>
        {futureDays.map(day=><section className="zy-m-task-section" key={day.date} aria-label={dateLabel(day.date)+'任务'}><h2>{dateLabel(day.date)} · {day.tasks.length} 项</h2>{day.tasks.map((task,index)=>row(task,'future',index))}</section>)}
        {!futureDays.length&&<div className="zy-m-task-empty">Molly：有想做的事，随时叫我来安排</div>}
      </>}
      {ready&&view==='history'&&<HistoryView model={historyModel} dispatch={dispatch} now={now} query="" actions={actions} scrollRef={scrollRef} renderTask={task=>row(task,'history')}/>}
      {ready&&<button type="button" className="zy-m-task-molly" onClick={()=>onOpenConversation('molly')}><TaskAvatar npc={npcs.find(npc=>npc.id==='molly')} size={20}/>让 Molly 安排任务</button>}
    </section>
  </div>;
}

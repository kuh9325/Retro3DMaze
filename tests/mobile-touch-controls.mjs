import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
test('temporary document-wide iOS selection lock and nonpassive touch interception',()=>{
 assert.match(html,/html\.maze-gamepad-touch body \*/);
 assert.match(html,/-webkit-user-select:none!important;user-select:none!important/);
 assert.match(html,/setTimeout\(\(\)=>document\.documentElement\.classList\.remove\('maze-gamepad-touch'\),400\)/);
 assert.match(html,/mobileControlArea\.addEventListener\('touchstart',[\s\S]*?\},\{passive:false\}\)/);
 assert.match(html,/e\.target\.closest\('\[data-control\]'\)&&e\.cancelable\)e\.preventDefault\(\)/);
 assert.match(html,/document\.addEventListener\('selectionchange'/);
});
test('mobile controls keep touch holds, multitouch and native Map/Auto clicks',()=>{
 const start=html.indexOf(' // iOS Safari can select text elsewhere');
 const end=html.indexOf('\n}\nfunction getOpenCells()',start);
 assert.ok(start>0 && end>start);
 const handlers=(s)=>({eventHandlers:{},addEventListener(name,fn){(this.eventHandlers[name]??=[]).push(fn);},fire(name,event){for(const fn of this.eventHandlers[name]??[])fn(event);}});
 const classes=new Set();
 const htmlRoot={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
 const buttons=Object.fromEntries(['forward','back','left','right','sprint'].map(key=>[key,{...handlers(),dataset:{control:key},setPointerCapture(){}}]));
 const area=handlers('area'),doc=handlers('document'),win=handlers('window');
 let scheduled=[],nextTimer=0;
 const selection={isCollapsed:true,removeAllRanges(){this.isCollapsed=true;}};
 Object.assign(doc,{documentElement:htmlRoot,querySelector:()=>area,querySelectorAll:()=>Object.values(buttons),hidden:false});
 Object.assign(win,{getSelection:()=>selection});
 const keys=new Set();
 let started=0;
 const context={document:doc,window:win,keys,stopped:true,begin(){started++;context.stopped=false;},autoplay:false,
  clearTimeout(id){scheduled=scheduled.filter(x=>x.id!==id);},
  setTimeout(fn){const id=++nextTimer;scheduled.push({id,fn});return id;}
 };
 vm.runInNewContext(html.slice(start,end),context);
 const target=(control)=>({closest:selector=>selector==='[data-control]'?(control?buttons[control]:null):null});
 const touch=(id)=>({identifier:id});
 const preventable=(control,ids)=>({changedTouches:ids.map(touch),target:target(control),cancelable:true,prevented:false,preventDefault(){this.prevented=true;}});
 const runDelayed=()=>{const q=scheduled.slice();scheduled=[];for(const t of q)t.fn();};
 let event=preventable('forward',[1]);buttons.forward.fire('touchstart',event);area.fire('touchstart',event);
 assert.equal(keys.has('arrowup'),true);assert.equal(started,1);assert.equal(event.prevented,true);
 assert.equal(classes.has('maze-gamepad-touch'),true);
 const e2=preventable('left',[2]);buttons.left.fire('touchstart',e2);area.fire('touchstart',e2);
 assert.equal(keys.has('arrowleft'),true);
 let selectionPrevented=false;
 doc.fire('selectstart',{preventDefault(){selectionPrevented=true;}});
 assert.equal(selectionPrevented,true);
 selection.isCollapsed=false;doc.fire('selectionchange',{});assert.equal(selection.isCollapsed,true);
 buttons.forward.fire('touchend',{targetTouches:[]});area.fire('touchend',preventable('forward',[1]));
 assert.equal(keys.has('arrowup'),false);assert.equal(keys.has('arrowleft'),true);
 runDelayed();assert.equal(classes.has('maze-gamepad-touch'),true,'other finger still down');
 buttons.left.fire('touchend',{targetTouches:[]});area.fire('touchend',preventable('left',[2]));
 assert.equal(keys.size,0);assert.equal(classes.has('maze-gamepad-touch'),true,'release grace period');
 runDelayed();assert.equal(classes.has('maze-gamepad-touch'),false);
 const mapTap=preventable(null,[3]);area.fire('touchstart',mapTap);
 assert.equal(mapTap.prevented,false,'map/auto native click must not be suppressed');
 area.fire('touchend',preventable(null,[3]));runDelayed();
 buttons.sprint.fire('pointerdown',{pointerType:'mouse',pointerId:42,preventDefault(){}});
 assert.equal(keys.has('shift'),true);
 buttons.sprint.fire('pointerup',{pointerType:'mouse'});assert.equal(keys.has('shift'),false);
 buttons.back.fire('touchstart',{});area.fire('touchstart',preventable('back',[5]));
 buttons.back.fire('touchcancel',{targetTouches:[]});area.fire('touchcancel',preventable('back',[5]));
 assert.equal(keys.has('arrowdown'),false);
});

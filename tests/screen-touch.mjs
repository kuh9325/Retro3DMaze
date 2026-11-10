import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../public/screen-touch.js', import.meta.url), 'utf8');
function makeElement() {
  const events = new Map(), classes = new Set();
  const element = {
    style: {}, classList: {add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name)},
    addEventListener(name, handler, opts) { (events.get(name) ?? (events.set(name, []), events.get(name))).push({handler, opts}); },
    fire(name, event) {for (const {handler} of events.get(name) ?? []) handler(event);},
    listeners(name) {return events.get(name) ?? [];},
    getBoundingClientRect() {return {left:0, top:0, width:400, height:240};}
  };
  return element;
}
const at = (id, x, y) => ({identifier:id, clientX:x, clientY:y});
function evt(...touches) {return {changedTouches:touches, cancelable:true, prevented:false, preventDefault(){this.prevented=true;}};}
function rig() {
  const canvas=makeElement(), viewport=makeElement(),joystick=makeElement(),thumb=makeElement();
  const win=makeElement(), doc=makeElement();doc.hidden=false;
  const context={window:win,document:doc,Math};
  vm.runInNewContext(src,context);
  let allowed=true,manual=0,angle=0;
  const controller=context.window.RetroScreenTouch.attach({canvas,viewport,joystick,thumb,
    enabled:()=>allowed,manualInput:()=>manual++,rotate:rad=>{angle+=rad;}});
  return {canvas,viewport,joystick,thumb,win,doc,controller,changeAllowed:v=>allowed=v, get manual(){return manual;},get angle(){return angle;}};
}

test('screen gestures are nonpassive to stop iOS scrolling and text selection',()=>{
 const r=rig();
 for(const name of ['touchstart','touchmove','touchend','touchcancel']) assert.equal(r.canvas.listeners(name)[0].opts.passive,false);
 const e=evt(at(1,70,150));r.canvas.fire('touchstart',e);assert.equal(e.prevented,true);
});
test('left floating joystick moves forward, back and strafes with smooth analog values',()=>{
 const r=rig();r.canvas.fire('touchstart',evt(at(1,70,150)));
 assert.equal(r.controller.getMove().forward,0);
 r.canvas.fire('touchmove',evt(at(1,70,84)));
 assert.ok(r.controller.getMove().forward>0.98);
 assert.equal(r.controller.getMove().strafe,0);
 assert.equal(r.joystick.classList.contains('active'),true);
 r.canvas.fire('touchmove',evt(at(1,125,150)));
 assert.ok(r.controller.getMove().strafe>0.95);
 r.canvas.fire('touchmove',evt(at(1,70,210)));
 assert.ok(r.controller.getMove().forward<-.95);
 r.canvas.fire('touchend',evt(at(1,70,210)));
 assert.deepEqual({...r.controller.getMove()},{forward:0,strafe:0});
 assert.equal(r.joystick.classList.contains('active'),false);
});
test('right-side drags rotate view but never move the player',()=>{
 const r=rig();r.canvas.fire('touchstart',evt(at(2,310,100)));
 r.canvas.fire('touchmove',evt(at(2,350,100)));
 assert.ok(r.angle>.35);
 assert.deepEqual({...r.controller.getMove()},{forward:0,strafe:0});
 r.canvas.fire('touchend',evt(at(2,350,100)));
});
test('two simultaneous fingers enable walking and looking together, individually release',()=>{
 const r=rig();r.canvas.fire('touchstart',evt(at(1,55,170),at(2,310,150)));
 r.canvas.fire('touchmove',evt(at(1,55,115),at(2,360,150)));
 assert.ok(r.controller.getMove().forward>.9);assert.ok(r.angle>.4);
 r.canvas.fire('touchend',evt(at(2,360,150)));
 assert.ok(r.controller.getMove().forward>.9,'releasing look should keep walking');
 r.canvas.fire('touchend',evt(at(1,55,115)));
 assert.equal(r.controller.getMove().forward,0);
});
test('cancel, blur, hidden tab and reset stop held motion without sticky input',()=>{
 const r=rig();r.canvas.fire('touchstart',evt(at(3,70,100)));
 r.canvas.fire('touchmove',evt(at(3,70,50)));
 r.canvas.fire('touchcancel',evt(at(3,70,50)));assert.equal(r.controller.getMove().forward,0);
 r.canvas.fire('touchstart',evt(at(4,70,100)));r.canvas.fire('touchmove',evt(at(4,70,50)));
 r.win.fire('blur',{});assert.equal(r.controller.getMove().forward,0);
 r.canvas.fire('touchstart',evt(at(5,70,100)));r.canvas.fire('touchmove',evt(at(5,70,50)));
 r.doc.hidden=true;r.doc.fire('visibilitychange',{});assert.equal(r.controller.getMove().forward,0);
 r.controller.reset();assert.equal(r.joystick.classList.contains('active'),false);
});
test('disabled, unrelated and unclaimed touches do not change controls',()=>{
 const r=rig();r.changeAllowed(false);
 const e=evt(at(3,70,100));r.canvas.fire('touchstart',e);assert.equal(e.prevented,false);
 r.changeAllowed(true);r.canvas.fire('touchstart',evt(at(1,10,70)));
 r.canvas.fire('touchstart',evt(at(2,40,80)));
 assert.equal(r.manual,1,'second touch in occupied left area not claimed');
 r.canvas.fire('touchmove',evt(at(2,40,10)));
 assert.equal(r.controller.getMove().forward,0);
});

test('game HTML integrates touch movement while keeping original D-pad and ranked play',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/<script src="\.\/screen-touch\.js"><\/script>/);
 assert.match(html,/id="screenTouchJoy"/);
 assert.match(html,/id="screenTouchThumb"/);
 assert.match(html,/screenTouch=window\.RetroScreenTouch\?\.attach\(/);
 assert.match(html,/touchInput=screenTouch\?\.getMove\(\)/);
 assert.match(html,/function win\(\)/);
 for(const direction of ['forward','back','left','right','sprint']){
  assert.match(html,new RegExp('data-control="'+direction+'"'));
 }
});
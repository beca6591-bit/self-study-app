import test from 'node:test';
import assert from 'node:assert/strict';
import {completeLesson} from '../server/content.mjs';

const day=86400000;
const start=Date.parse('2026-10-06T00:00:00Z');
const lesson={id:'lesson-test',status:'learning'};
const attempt=(id,at,status='completed',lessonId=lesson.id)=>({id,createdAt:new Date(at).toISOString(),status,lessonId});

test('completion can happen before answering, but replay cannot advance review',()=>{
 const first=completeLesson(lesson,[],'initial',start);
 assert.equal(first.reviewAt,new Date(start+day).toISOString());
 assert.deepEqual(completeLesson(first,[],'initial',start+day),first);
 assert.throws(()=>completeLesson(first,[],first.reviewAt,start+day),/本轮新回答/);
});

test('new review evidence advances once and old or unrelated evidence cannot complete again',()=>{
 const old=attempt('old',start-1);
 const first=completeLesson(lesson,[old],'initial',start);
 for(const evidence of [[old],[attempt('failed',start+1,'failed')],[attempt('other',start+1,'completed','another')]]){
  assert.throws(()=>completeLesson(first,evidence,first.reviewAt,start+day),/本轮新回答/);
 }
 const evidence=[old,attempt('review',start+day)];
 const next=completeLesson(first,evidence,first.reviewAt,start+day+1);
 assert.equal(next.reviewCount,1);
 assert.equal(Date.parse(next.reviewAt),start+4*day+1);
 assert.deepEqual(completeLesson(next,[...evidence,attempt('later',start+2*day)],first.reviewAt,start+2*day),next);
 assert.throws(()=>completeLesson(next,evidence,next.reviewAt,start+2*day),/本轮新回答/);
});

test('legacy records retain their schedule until a new attempt and current round token are supplied',()=>{
 const legacy={...lesson,status:'completed',reviewCount:1,reviewAt:new Date(start+3*day).toISOString()};
 assert.throws(()=>completeLesson(legacy,[],undefined,start+day),/刷新/);
 assert.throws(()=>completeLesson(legacy,[attempt('old',start-1)],legacy.reviewAt,start+day),/本轮新回答/);
 assert.equal(completeLesson(legacy,[attempt('new',start+1)],legacy.reviewAt,start+day).reviewCount,2);
});

test('new classroom answers cannot consume a self-test round',()=>{
 const first=completeLesson(lesson,[],'initial',start);
 assert.throws(()=>completeLesson(first,[{...attempt('classroom',start+1),scene:'classroom'}],first.reviewAt,start+day),/本轮新回答/);
 const next=completeLesson(first,[{...attempt('review',start+1),scene:'review'}],first.reviewAt,start+day);
 assert.equal(next.reviewCount,1);
});

test('self test before learning completion schedules three days without completing lesson',()=>{
 const next=completeLesson(lesson,[{...attempt('review',start+1),scene:'review'}],'initial',start+2,'review');
 assert.equal(next.status,'learning');assert.equal(Date.parse(next.reviewAt),start+2+3*day);
 assert.throws(()=>completeLesson(next,[],next.reviewAt,start+3,'review'),/本轮新回答/);
});

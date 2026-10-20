// Pure transformations: shared by import, API output, and regression checks.
export function chunks(segments,sourceId){
 const result=[];let text='',start=0,end=0;
 const flush=()=>{if(text.trim())result.push({id:`${sourceId}:${result.length+1}`,text:text.trim(),start,end});text=''};
 for(const seg of segments){const value=String(seg.text||'');
  // Split oversized paragraphs too; never silently truncate documents.
  for(let offset=0;offset<value.length;offset+=11999){const piece=value.slice(offset,offset+11999);if(text.length+piece.length+1>12000)flush();if(!text)start=seg.start||0;text+=piece+'\n';end=(seg.start||0)+(seg.duration||0)}
 }flush();return result;
}
export function publicLesson(l){if(!l)return null;return {...l,content:l.content?{...l.content,questions:l.content.questions.map(({answer,rubric,...q})=>q)}:null}}
export function reviewSchedule(lesson,now=Date.now()){
 const reviewing=lesson.status==='completed';const count=reviewing?(lesson.reviewCount||0)+1:0;
 const days=reviewing?3:1;
 return {reviewCount:count,reviewAt:new Date(now+days*86400000).toISOString()};
}

// The date displayed when completion starts identifies the round. Replayed
// requests cannot consume new evidence or advance the next round.
export function completeLesson(lesson,attempts,expectedReviewAt,now=Date.now(),scene){
 const token=lesson.reviewAt||'initial';
 if(expectedReviewAt!==undefined&&expectedReviewAt!==token)return lesson;
 const completed=lesson.status==='completed';
 if(scene==='classroom'&&completed)return lesson;
 const evidence=attempts.filter(a=>a.lessonId===lesson.id&&a.status==='completed'&&(a.scene===undefined||a.scene==='review'));
 if(completed||scene==='review'){
  if(expectedReviewAt===undefined)throw new Error('请刷新课节后重新完成复习。');
  const previousTime=lesson.reviewCompletedAt||new Date((lesson.reviewAt?Date.parse(lesson.reviewAt):0)-[1,3,7,14,30][Math.min(lesson.reviewCount||0,4)]*86400000).toISOString();
  const consumed=new Set(lesson.reviewAttemptIds||[]);
  if(!evidence.some(a=>!consumed.has(a.id)&&a.createdAt>previousTime))throw new Error('请先提交本轮新回答并等待反馈完成，再完成复习。');
 }
 return {...lesson,completionSchemaVersion:2,status:scene==='review'?lesson.status:'completed',...(scene==='review'?{reviewCount:(lesson.reviewCount||0)+1,reviewAt:new Date(now+3*86400000).toISOString()}:reviewSchedule(lesson,now)),reviewCompletedAt:new Date(now).toISOString(),reviewAttemptIds:evidence.map(a=>a.id)};
}

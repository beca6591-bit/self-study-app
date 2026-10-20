// Rendering fixtures only: these are never claimed as model-generated content.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),dataDir=path.join(root,'data-book-native-ui');
process.env.SELF_STUDY_DATA_DIR=dataDir;
await mkdir(dataDir,{recursive:true});await cp(path.join(root,'data-book-on-demand-1792300271502/book-engine'),path.join(dataDir,'book-engine'),{recursive:true});
const book_id='bk_8177b19934',page_id='pg_246ba30820';
const pageFile=path.join(dataDir,'book-engine/data/user/workspace/book/book_'+book_id+'/pages/'+page_id+'.json');
const page=JSON.parse(await readFile(pageFile));
const block=(id,type,payload)=>({id,type,status:'ready',params:{},metadata:{},payload});
page.blocks=[
 block('chart','figure',{render_type:'chartjs',code:{content:JSON.stringify({type:'bar',data:{labels:['边 a','边 b','斜边 c'],datasets:[{label:'边长',data:[3,4,5]}]}})},description:'Chart.js 展示验收'}),
 block('mermaid','figure',{render_type:'mermaid',code:{content:'flowchart LR\n A[直角三角形] --> B[两直角边平方和]\n B --> C[斜边平方]'},description:'Mermaid 展示验收'}),
 block('interactive','interactive',{render_type:'html',code:{content:'<!doctype html><html><head><title>交互验收</title></head><body><h2>改变边长</h2><button onclick="document.getElementById(\'value\').textContent=4">增加</button><output id="value">3</output><button onclick="sendPrompt(\'为什么斜边最长？\')">询问这一点</button></body></html>'},description:'隔离 HTML 交互验收'}),
 block('quiz','quiz',{questions:[{question_id:'q1',question:'直角边是 3 和 4，斜边是多少？',question_type:'choice',options:{A:'5',B:'7'},correct_answer:'A',explanation:'由勾股定理，斜边平方为 25。'}]}),
 block('code','code',{language:'python',code:'print((3**2 + 4**2)**0.5)',explanation:'结果为 5。'}),
 block('timeline','timeline',{events:[{date:'第一步',title:'识别直角',description:'确认适用条件'}]})];
page.status='ready';await writeFile(pageFile,JSON.stringify(page));
const {save}=await import('../server/store.mjs');save('projects',{id:'native-ui-fixture',kind:'book',title:'模块展示验收（测试数据）',profile:{goal:'仅供渲染验收'},bookId:book_id,stage:'reading',createdAt:new Date().toISOString()});console.log(dataDir);

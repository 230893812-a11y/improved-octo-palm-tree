(function(){
  var modeButtons=document.querySelectorAll('[data-mode]');
  var jdCard=document.getElementById('jdCard');
  var resumeText=document.getElementById('resumeText');
  var jobText=document.getElementById('jobText');
  var fileInput=document.getElementById('resumeFile');
  var fileStatus=document.getElementById('fileStatus');
  var charCount=document.getElementById('charCount');
  var analyzeButton=document.getElementById('analyzeButton');
  var results=document.getElementById('results');
  var apiBase=window.RESUME_AUDIT_API_BASE||'http://localhost:3000';
  var currentMode='general';
  var resultFields={
    general:{
      eyebrow:'分析预览 · GENERAL CHECK',
      title:'先处理最影响可信度的三件事。',
      summary:'这份简历可能不是经历不足，而是没有把个人贡献、交付结果和能够证明能力的证据说清楚。',
      issues:[
        ['优先级 01 · 个人贡献','“负责 / 参与”出现多次','这些词本身没有错，但当前没有说明你具体负责了哪个环节，招聘者难以区分个人贡献和团队成果。','可能追问：你具体负责或参与了哪一部分？'],
        ['优先级 02 · 成果证据','行动多，结果少','项目描述包含工作动作，但没有交付物、上线状态、用户反馈、时间变化或其他可验证结果。','需要补充：最终交付了什么？'],
        ['优先级 03 · 表达清晰度','技能和经历没有连起来','技能列表中的工具或技术没有在项目经历中出现使用场景，容易被看成关键词堆砌。','可能追问：在哪个项目中实际使用？']
      ],
      next:'补充真实事实后，系统才会生成安全改写。当前演示不会替你编造数字、职责或成果。'
    },
    targeted:{
      eyebrow:'分析预览 · TARGETED CHECK',
      title:'先处理最影响岗位匹配度的三件事。',
      summary:'这份简历已经提到部分相关技能，但还没有用足够具体的证据证明你满足这个岗位的核心要求。',
      issues:[
        ['优先级 01 · 要求覆盖','核心岗位要求缺少明确证据','JD 中的核心要求没有在简历经历里形成清晰对应，招聘者需要额外猜测你是否做过相关工作。','可能追问：你在哪段经历中满足这项要求？'],
        ['优先级 02 · 技能关联','技能和项目场景没有连起来','简历列出了相关工具或技术，但没有说明在哪个项目中使用、解决了什么问题。','可能追问：你在哪个项目中实际使用过它？'],
        ['优先级 03 · 证据强度','行动描述不足以证明岗位匹配','你写了做过什么，但缺少交付物、上线状态、范围或结果，岗位匹配度因此难以核验。','需要补充：这项工作产生了什么可验证结果？']
      ],
      next:'先确认每项岗位要求对应的真实经历，再生成岗位定向改写。当前演示不会替你编造数字、职责或成果。'
    }
  };
  function renderResults(mode){
    var data=resultFields[mode];
    document.getElementById('resultEyebrow').textContent=data.eyebrow;
    document.getElementById('resultTitle').textContent=data.title;
    document.getElementById('resultSummary').textContent=data.summary;
    data.issues.forEach(function(issue,index){var n=index+1;document.getElementById('issueLabel'+n).textContent=issue[0];document.getElementById('issueTitle'+n).textContent=issue[1];document.getElementById('issueBody'+n).textContent=issue[2];document.getElementById('issueQuestion'+n).textContent=issue[3];});
    document.getElementById('nextStepText').textContent=data.next;
  }
  function updateCount(){charCount.textContent=resumeText.value.length.toLocaleString()+' / 12,000';}
  modeButtons.forEach(function(button){button.addEventListener('click',function(){currentMode=button.dataset.mode;modeButtons.forEach(function(item){var active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',String(active));});jdCard.hidden=currentMode!=='targeted';if(!results.hidden)renderResults(currentMode);});});
  resumeText.addEventListener('input',updateCount);
  fileInput.addEventListener('change',async function(){
    var file=fileInput.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){fileStatus.textContent='文件超过 5 MB，请更换文件';fileStatus.classList.add('is-error');fileInput.value='';return}
    var isTxt=file.name.toLowerCase().endsWith('.txt');
    var isPdf=file.name.toLowerCase().endsWith('.pdf');
    var isDocx=file.name.toLowerCase().endsWith('.docx');
    if(!isTxt&&!isPdf&&!isDocx){fileStatus.textContent='当前支持 TXT、文字型 PDF 和 DOCX；不支持旧版 DOC';fileStatus.classList.add('is-error');fileInput.value='';return}
    var fileLabel=isPdf?'PDF':(isDocx?'DOCX':'TXT');
    fileStatus.textContent='正在通过本地后端读取 '+fileLabel+'……';
    fileStatus.classList.remove('is-error');
    fileInput.disabled=true;
    try{
      var contentType=isPdf?'application/pdf':(isDocx?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/plain; charset=utf-8');
      var response=await fetch(apiBase+'/api/extract-resume',{method:'POST',headers:{'Content-Type':contentType,'X-File-Name':encodeURIComponent(file.name)},body:file});
      var payload=await response.json();
      if(!response.ok)throw new Error(payload&&payload.error&&payload.error.message?payload.error.message:'TXT 读取失败');
      resumeText.value=payload.resume_text;
      updateCount();
      fileStatus.textContent=(isPdf?'PDF 已读取：'+payload.page_count+' 页，':fileLabel+' 已读取：')+payload.character_count.toLocaleString()+' 字符；原文件未保存';
    }catch(error){
      fileStatus.textContent=(error instanceof TypeError?'无法连接本地后端，请确认服务器正在运行':error.message)+'；文本框保留上一次成功读取的内容';
      fileStatus.classList.add('is-error');
      fileInput.value='';
    }finally{
      fileInput.disabled=false;
    }
  });
  analyzeButton.addEventListener('click',function(){if(!resumeText.value.trim()&&!fileInput.files.length){fileStatus.textContent='请先粘贴简历文本或选择文件';fileStatus.classList.add('is-error');return}if(resumeText.value.length>12000){fileStatus.textContent='文本超过 12,000 字，请精简后重试';fileStatus.classList.add('is-error');return}if(currentMode==='targeted'&&!jobText.value.trim()){jobText.focus();return}renderResults(currentMode);results.hidden=false;results.scrollIntoView({behavior:'smooth',block:'start'});});
  fileInput.value='';
  fileStatus.textContent='第 8C 脚本已就绪：可选择 TXT、文字型 PDF 或 DOCX';
  fileStatus.classList.remove('is-error');
  document.documentElement.dataset.auditBuild='8c-20260911-1';
  updateCount();
})();

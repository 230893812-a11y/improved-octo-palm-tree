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
  var apiBase=window.RESUME_AUDIT_API_BASE||'https://knowledge-rag-d3gfdtvrf17fca5f7-1480424263.ap-shanghai.app.tcloudbase.com/resume-audit-api';
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
  function renderApiResults(payload){
    var analysis=payload&&payload.model_analysis?payload.model_analysis:payload&&payload.rule_analysis;
    if(!analysis)throw new Error('服务器返回的数据缺少分析结果');
    document.getElementById('resultEyebrow').textContent=currentMode==='targeted'?'线上分析 · TARGETED CHECK':'线上分析 · GENERAL CHECK';
    document.getElementById('resultTitle').textContent=analysis.summary||resultFields[currentMode].title;
    var gaps=Array.isArray(analysis.evidence_gaps)?analysis.evidence_gaps:[];
    for(var i=0;i<3;i++){
      var gap=gaps[i];
      var n=i+1;
      document.getElementById('issueLabel'+n).textContent=gap?('优先级 0'+n+' · '+(gap.category||'证据缺口')):('优先级 0'+n);
      document.getElementById('issueTitle'+n).textContent=gap?(gap.claim||'需要补充事实'):'暂无更多问题';
      document.getElementById('issueBody'+n).textContent=gap?(gap.explanation||'当前证据不足。'):'当前没有更多结构化问题。';
      document.getElementById('issueQuestion'+n).textContent=gap&&gap.related_evidence?('相关原文：'+gap.related_evidence):((analysis.follow_up_questions||[])[i]||'请补充可验证的真实事实。');
    }
    document.getElementById('nextStepText').textContent=analysis.safety_note||'结果仅基于你提供的简历和岗位信息。';
    var badge=document.querySelector('.demo-badge');
    if(badge)badge.textContent=analysis.provider==='deepseek'?'DeepSeek 结果':'规则结果';
  }
  modeButtons.forEach(function(button){button.addEventListener('click',function(){currentMode=button.dataset.mode;modeButtons.forEach(function(item){var active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-selected',String(active));});jdCard.hidden=currentMode!=='targeted';if(!results.hidden)renderResults(currentMode);});});
  resumeText.addEventListener('input',updateCount);
  function formatPdfTextItems(items){
    var lines=[];
    var currentLine=[];
    var currentY=null;
    var currentHeight=0;
    function flushLine(){
      if(!currentLine.length)return;
      var text='';
      var previous=null;
      currentLine.forEach(function(part){
        if(previous){
          var gap=part.x-(previous.x+previous.width);
          var spacingThreshold=Math.max(1.5,Math.max(previous.height,part.height)*0.18);
          if(gap>spacingThreshold&&!/\s$/.test(text)&&!/^\s/.test(part.text))text+=' ';
        }
        text+=part.text;
        previous=part;
      });
      text=text.replace(/[ \t]+/g,' ').trim();
      if(text)lines.push({text:text,y:currentY,height:currentHeight||10});
      currentLine=[];
      currentY=null;
      currentHeight=0;
    }
    items.forEach(function(item){
      var text=typeof item.str==='string'?item.str:'';
      if(!text)return;
      var transform=Array.isArray(item.transform)?item.transform:[];
      var y=Number(transform[5]);
      var x=Number(transform[4]);
      var height=Math.abs(Number(item.height)||Number(transform[3])||10);
      if(!Number.isFinite(y))y=currentY===null?0:currentY;
      if(!Number.isFinite(x))x=currentLine.length?currentLine[currentLine.length-1].x+currentLine[currentLine.length-1].width:0;
      var lineTolerance=Math.max(2,height*0.25);
      if(currentY!==null&&Math.abs(y-currentY)>lineTolerance)flushLine();
      if(currentY===null)currentY=y;
      currentHeight=Math.max(currentHeight,height);
      currentLine.push({text:text,x:x,width:Math.abs(Number(item.width)||0),height:height});
      if(item.hasEOL)flushLine();
    });
    flushLine();
    var output='';
    lines.forEach(function(line,index){
      if(index){
        var previous=lines[index-1];
        var verticalGap=Math.abs(previous.y-line.y);
        var paragraphGap=Math.max(previous.height,line.height)*1.65;
        output+=verticalGap>paragraphGap?'\n\n':'\n';
      }
      output+=line.text;
    });
    return output.trim();
  }
  async function readLocalFile(file,isTxt,isPdf,isDocx){
    if(isTxt)return await file.text();
    if(isDocx){
      if(!window.mammoth)throw new Error('DOCX 解析组件尚未加载，请刷新页面后重试');
      var doc=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
      return doc.value||'';
    }
    if(isPdf){
      if(!window.pdfjsLib)throw new Error('PDF 解析组件尚未加载，请刷新页面后重试');
      var pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      if(pdf.numPages>5)throw new Error('PDF 超过 5 页，请精简后重试');
      var pages=[];
      for(var pageNo=1;pageNo<=pdf.numPages;pageNo++){
        var page=await pdf.getPage(pageNo);
        var content=await page.getTextContent();
        pages.push(formatPdfTextItems(content.items));
      }
      return pages.filter(Boolean).join('\n\n');
    }
    return '';
  }
  fileInput.addEventListener('change',async function(){
    var file=fileInput.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){fileStatus.textContent='文件超过 5 MB，请更换文件';fileStatus.classList.add('is-error');fileInput.value='';return}
    var isTxt=file.name.toLowerCase().endsWith('.txt');
    var isPdf=file.name.toLowerCase().endsWith('.pdf');
    var isDocx=file.name.toLowerCase().endsWith('.docx');
    if(!isTxt&&!isPdf&&!isDocx){fileStatus.textContent='当前支持 TXT、文字型 PDF 和 DOCX；不支持旧版 DOC';fileStatus.classList.add('is-error');fileInput.value='';return}
    var fileLabel=isPdf?'PDF':(isDocx?'DOCX':'TXT');
    fileStatus.textContent='正在浏览器本地读取 '+fileLabel+'……';
    fileStatus.classList.remove('is-error');
    fileInput.disabled=true;
    try{
      var text=await readLocalFile(file,isTxt,isPdf,isDocx);
      if(!text.trim())throw new Error(isPdf?'PDF 中没有可读取的文字，可能是扫描件':'文件中没有可读取的文字');
      if(text.length>12000)throw new Error('提取文字超过 12,000 字，请精简后重试');
      resumeText.value=text;
      updateCount();
      fileStatus.textContent=(isPdf?'PDF 已在浏览器本地读取：':fileLabel+' 已在浏览器本地读取：')+text.length.toLocaleString()+' 字符；原文件未上传';
    }catch(error){
      fileStatus.textContent=(error instanceof TypeError?'无法连接本地后端，请确认服务器正在运行':error.message)+'；文本框保留上一次成功读取的内容';
      fileStatus.classList.add('is-error');
    }finally{
      fileInput.value='';
      fileInput.disabled=false;
    }
  });
  analyzeButton.addEventListener('click',async function(){
    if(!resumeText.value.trim()&&!fileInput.files.length){fileStatus.textContent='请先粘贴简历文本或选择文件';fileStatus.classList.add('is-error');return}
    if(resumeText.value.length>12000){fileStatus.textContent='文本超过 12,000 字，请精简后重试';fileStatus.classList.add('is-error');return}
    if(currentMode==='targeted'&&!jobText.value.trim()){jobText.focus();fileStatus.textContent='目标岗位模式需要先填写 JD';fileStatus.classList.add('is-error');return}
    analyzeButton.disabled=true;
    analyzeButton.textContent='正在分析……';
    fileStatus.textContent='正在提交文本，原文不会保存到页面；请稍候';
    fileStatus.classList.remove('is-error');
    try{
      var controller=new AbortController();
      var timeoutId=setTimeout(function(){controller.abort();},45000);
      var response=await fetch(apiBase+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({mode:currentMode,engine:'deepseek',resume_text:resumeText.value,job_text:currentMode==='targeted'?jobText.value:''})});
      clearTimeout(timeoutId);
      var payload=await response.json();
      if(!response.ok)throw new Error(payload&&payload.error&&payload.error.message?payload.error.message:'分析请求失败');
      renderApiResults(payload); results.hidden=false; results.scrollIntoView({behavior:'smooth',block:'start'}); fileStatus.textContent='线上分析完成；页面不会保存你的原文';
    }catch(error){fileStatus.textContent=error.name==='AbortError'?'分析等待超过 45 秒，可能是网络或模型服务较慢，请稍后重试':(error.message||'分析请求失败')+'；你可以稍后重试';fileStatus.classList.add('is-error');}
    finally{analyzeButton.disabled=false;analyzeButton.innerHTML='开始分析 <span>→</span>';}
  });
  function clearPrivateInputs(){fileInput.value='';resumeText.value='';jobText.value='';results.hidden=true;updateCount();}
  clearPrivateInputs();
  window.addEventListener('pageshow',function(event){if(event.persisted)clearPrivateInputs();});
  fileStatus.textContent='第 8D 脚本已就绪：文件不落盘，页面刷新后清空文本';
  fileStatus.classList.remove('is-error');
  document.documentElement.dataset.auditBuild='pdf-layout-20260912-1';
})();

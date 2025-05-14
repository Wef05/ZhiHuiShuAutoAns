 (async function () {
  // ===== 通用通知函数 =====
  async function sendNotification(text) {
    const url = "https://api.chanify.net/v1/sender/MessageAPI";
    try {
      await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ text })
      });
    } catch (e) {
      console.warn("通知发送失败：", e.message);
    }
  }

  const isCoursePage = location.href.includes("onlineweb.zhihuishu.com");
  const isScorePage = location.href.includes("stuonline.zhihuishu.com");

  const allScores = [];

  const ui = document.createElement("div");
  ui.style.position = "fixed";
  ui.style.top = "10px";
  ui.style.right = "10px";
  ui.style.width = "320px";
  ui.style.padding = "10px";
  ui.style.backgroundColor = "white";
  ui.style.border = "2px solid #ccc";
  ui.style.zIndex = "999999";
  ui.style.fontSize = "14px";
  ui.style.maxHeight = "90vh";
  ui.style.overflowY = "auto";
  document.body.appendChild(ui);

  const log = (msg, replace = false) => {
    console.log("[ZhihuAuto]", msg);
    if (replace) {
      ui.innerHTML = `<div><strong>${msg}</strong></div>`;
    } else {
      const logEl = document.createElement("div");
      logEl.textContent = msg;
      ui.appendChild(logEl);
    }
  };

  window.addEventListener("message", (e) => {
    if (e.data?.type === "score") {
      allScores.push(e.data.payload);
    }
  });

  if (isCoursePage) {
    log("当前为课程导航页，等待 5 秒开始加载课程...");
    setTimeout(loadCoursesAndRenderUI, 5000);
  } else if (isScorePage) {
    setTimeout(async () => {
      const course = document.title.split("-")[0].trim();
      const getVal = sel => (document.querySelector(sel)?.textContent || "无数据").trim();
      const result = {
        课程名: course,
        总成绩: getVal("#courseScore"),
        满分: getVal("#totalCourseScore"),
        学习进度: getVal("#mySchedulePrice"),
        学习时间: getVal("#studyTime"),
        互动得分: getVal("#learnedInteractiveScore"),
        单元测试: getVal("#chapterTestingScore")
      };
      window.opener?.postMessage({ type: "score", payload: result }, "*");
      setTimeout(() => window.close(), 1000);
    }, 3000);
  } else {
    setTimeout(() => {
      if (document.body.innerText.includes("问答详情")) {
        log("进入回答页面，准备自动回答...");
        autoAnswerFlow();
      } else if (document.querySelector(".question-list-container")) {
        log("进入问题列表页面，准备点击问题...");
        autoClickQuestions();
      }
    }, 5000);
  }

  async function loadCoursesAndRenderUI() {
    for (let i = 0; i < 20; i++) {
      const moreBtn = document.querySelector("#sharingClassed > div:nth-child(2) > div > span.message");
      if (!moreBtn || moreBtn.innerText.includes("没有更多")) break;
      moreBtn.click();
      log(`点击查看更多第 ${i + 1} 次...`);
      await new Promise(r => setTimeout(r, 1500));
    }

    await new Promise(r => setTimeout(r, 2000));
    const ulElements = document.querySelectorAll("#sharingClassed > div:nth-child(2) > ul");
    const courses = [];
    ulElements.forEach((ul, index) => {
      const nameEl = ul.querySelector("div.courseName");
      const btnEl = ul.querySelector("div.right-item-course ul li:nth-child(3) a");
      const scoreEl = ul.querySelector("div.right-item-course ul li:nth-child(1) a");
      if (nameEl && btnEl && scoreEl) {
        const name = nameEl.innerText.trim();
        courses.push({ name, button: btnEl, score: scoreEl, index });
      }
    });

    if (courses.length === 0) {
      log("❌ 未能获取任何课程");
      await sendNotification("❌ 未获取到课程，任务终止");
      return;
    }

    ui.innerHTML += `<div><strong>选择课程（默认全选）：</strong></div>`;
    const checkboxes = [];
    courses.forEach((c, i) => {
      const id = `chk_${i}`;
      ui.innerHTML += `<div><input type="checkbox" id="${id}" checked /> ${c.name}</div>`;
      checkboxes.push({ id, name: c.name, button: c.button, score: c.score });
    });

    ui.innerHTML += `<div style="margin-top:10px;">每门课程点击问题数量：<span id="qcount">10</span></div>
      <input id="questionSlider" type="range" min="1" max="30" value="10" style="width:100%;" />
      <button id="startAll" style="margin-top:10px;width:100%;">开始自动答题</button>
      <button id="startScore" style="margin-top:5px;width:100%;">查看成绩报告</button>
      <div id="taskLog" style="margin-top:10px;color:#555;">等待开始</div>
      <div id="countdown" style="margin-top:5px;color:red;"></div>`;

    const qSlider = document.getElementById("questionSlider");
    const qDisplay = document.getElementById("qcount");
    const taskLog = document.getElementById("taskLog");
    const countdownEl = document.getElementById("countdown");
    qSlider.oninput = () => (qDisplay.textContent = qSlider.value);

    document.getElementById("startAll").onclick = async () => {
      const selected = checkboxes.filter(c => document.getElementById(c.id).checked);
      const perCourseCount = parseInt(qSlider.value);
      if (selected.length === 0) {
        taskLog.textContent = "你未选择任何课程";
        return;
      }

      log(`即将开始，${selected.length}门课程，每门答${perCourseCount}个问题`);
      await sendNotification("自动答题任务开始，共" + selected.length + "门课程");

      let courseIndex = 0;
      const courseInterval = (perCourseCount * 30 + 180) * 1000;
      let nextLaunchTime = Date.now() + courseInterval;

      const launchCourse = (course) => {
        window.name = JSON.stringify({ maxClickCount: perCourseCount, courseName: course.name });
        sendNotification(`📘 开始答题：${course.name}`);
        window.open(course.button.href, '_blank');
        nextLaunchTime = Date.now() + courseInterval;
      };

      const countdown = setInterval(() => {
        if (courseIndex >= selected.length) {
          clearInterval(countdown);
          countdownEl.textContent = "✅ 所有课程已启动完毕";
          taskLog.textContent = "✅ 任务完成";
          sendNotification("✅ 所有课程已完成自动答题任务");
          return;
        }
        const remainingMs = nextLaunchTime - Date.now();
        const min = Math.floor(remainingMs / 60000);
        const sec = Math.floor((remainingMs % 60000) / 1000);
        countdownEl.textContent = `下一个课程将在 ${min} 分 ${sec} 秒后开始...`;
      }, 1000);

      launchCourse(selected[0]);
      courseIndex++;

      const intervalTask = setInterval(() => {
        if (courseIndex >= selected.length) {
          clearInterval(intervalTask);
          return;
        }
        launchCourse(selected[courseIndex]);
        courseIndex++;
      }, courseInterval);
    };

    document.getElementById("startScore").onclick = async () => {
      const selected = checkboxes.filter(c => document.getElementById(c.id).checked);
      selected.forEach((course, i) => {
        setTimeout(() => {
          window.open(course.score.href, '_blank');
        }, i * 3000);
      });

      setTimeout(() => {
        const win = window.open('', '', 'width=600,height=600');
        win.document.write('<pre>' + JSON.stringify(allScores, null, 2) + '</pre>');
      }, selected.length * 4000);
    };
  }

  async function autoClickQuestions() {
    let maxCount = 30;
    let courseName = "未知课程";
    try {
      const data = JSON.parse(window.name || "{}");
      if (data.maxClickCount) maxCount = parseInt(data.maxClickCount);
      if (data.courseName) courseName = data.courseName;
    } catch {}

    //await sendNotification(`📥 开始问题列表点击：${courseName}`);

    const statusArea = document.createElement("div");
    statusArea.style.marginTop = "10px";
    statusArea.style.color = "#006";
    ui.appendChild(statusArea);

    const tabs = document.querySelectorAll(".tab-item");
    for (let tab of tabs) {
      if (tab.innerText.includes("最新")) {
        tab.click();
        statusArea.textContent = "已点击“最新”标签，等待加载...";
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    const allItems = document.querySelectorAll("#app .question-list-container ul > li");
    const validItems = Array.from(allItems).filter((_, i) => i % 2 === 1).slice(0, maxCount);

    let current = 0;
    let secondsLeft = 30;

    const clickNext = () => {
      if (current >= validItems.length) {
        statusArea.textContent = "任务完成，关闭标签页...";
        //sendNotification(`✅ 完成：${courseName} 答题`);
        setTimeout(() => {
          window.open('', '_self');
          window.close();
        }, 1000);
        return;
      }

      const item = validItems[current];
      const span = item.querySelector("div.question-content.ZHIHUISHU_QZMD");
      if (span) span.click();

      current++;
      secondsLeft = 30;
      const countdown = setInterval(() => {
        secondsLeft--;
        statusArea.textContent = `已点击第 ${current} 个问题，距离下次点击还有 ${secondsLeft} 秒...（剩余 ${maxCount - current}）`;
        if (secondsLeft <= 0) {
          clearInterval(countdown);
          clickNext();
        }
      }, 1000);
    };

    clickNext();
  }

  async function autoAnswerFlow() {
    try {
      const targetSpan = document.querySelector("html body div:nth-of-type(2) div div:nth-of-type(3) div:nth-of-type(1) div:nth-of-type(1) div:nth-of-type(3) p span");
      if (!targetSpan) return;
      const readText = targetSpan.textContent.trim();

      const response = await fetch("https://dashscope.aliyuncs.com/api/v1/apps/0d526aaeec634ca9af441ee94900902d/completion", {
        method: "POST",
        headers: {
          "Authorization": "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: { prompt: readText },
          parameters: {},
          debug: {}
        })
      });

      const result = await response.json();
      const outputText = result?.output?.text || "";

      const answerBtn = document.querySelector("#app > div > div.my-answer-btn.ZHIHUISHU_QZMD.tool-show");
      if (!answerBtn) {
        sendNotification(`⚠️ 重复问题`);
          setTimeout(() => {
            window.open('', '_self');
            window.close();
          }, 1000);
        return;
      }

      answerBtn.click();

      const waitForTextarea = () => new Promise((res, rej) => {
        let tries = 0;
        const interval = setInterval(() => {
          const ta = document.querySelector("textarea");
          if (ta) {
            clearInterval(interval);
            res(ta);
          }
          if (++tries > 50) {
            clearInterval(interval);
            rej();
          }
        }, 100);
      });

      const ta = await waitForTextarea();
      ta.value = outputText;
      ta.dispatchEvent(new Event('input', { bubbles: true }));

      let canceled = false;
      const cancel = () => (canceled = true);
      window.addEventListener("keydown", cancel);

      setTimeout(() => {
        window.removeEventListener("keydown", cancel);
        if (canceled) return;
        const submit = document.querySelector("div.dialog-bottom.clearfix > div");
        if (submit) {
          submit.click();
          setTimeout(() => {
            window.open('', '_self');
            window.close();
          }, 1000);
        }
      }, 3000);
    } catch (err) {
      await sendNotification("回答流程错误：" + err.message);
    }
  }
})();
auto.waitFor()
var { four_player_battle } = hamibot.env;
var { two_player_battle } = hamibot.env;
var { count } = hamibot.env;
var { whether_improve_accuracy } = hamibot.env;
var { baidu_or_huawei } = hamibot.env;
var delay_time = 1000;
count = Number(count);

// 将设备保持常亮
device.keepScreenDim();
// 调用华为api所需参数
var { username } = hamibot.env;
var { password } = hamibot.env;
var { domainname } = hamibot.env;
var { projectname } = hamibot.env;
var { endpoint } = hamibot.env;
var { projectId } = hamibot.env;
var { pushplus_token } = hamibot.env;
// 调用百度api所需参数
var { AK } = hamibot.env;
var { SK } = hamibot.env;

if (whether_improve_accuracy == 'yes' && !password && !AK) {
  toast("如果你选择了增强版，请配置信息，具体看脚本说明");
  exit();
}

// 检查Hamibot版本是否支持ocr
if (app.versionName < "1.3.0") {
  toast("请将Hamibot更新至最新版v1.3.0");
  exit();
}

//请求横屏截图权限
threads.start(function () {
  try {
    var beginBtn;
    if (beginBtn = classNameContains("Button").textContains("开始").findOne(delay_time));
    else (beginBtn = classNameContains("Button").textContains("允许").findOne(delay_time));
    beginBtn.click();
  } catch (error) {
  }
});
requestScreenCapture(false);
sleep(delay_time);

// 模拟随机时间
function random_time(time) {
  return time + random(100, 1000);
}
/**
  * 推送通知到微信
  * @param {string} account 账号
  * @param {string} score 分数
  */
function push_weixin_message(account, score) {
  http.postJson(
    'http://www.pushplus.plus/send',
    {
      token: pushplus_token,
      title: '强国学习通知',
      content: '账号名' + account + '今日已经获得' + score + '分'
    }
  );
}
function entry_model(number) {
  sleep(random_time(delay_time * 2));
  var model = className('android.view.View').depth(22).findOnce(number);
  while (!model.child(3).click());
}

// 模拟点击可点击元素
function my_click_clickable(target) {
  text(target).waitFor();
  // 防止点到页面中其他有包含“我的”的控件，比如搜索栏
  if (target == '我的') {
    id("comm_head_xuexi_mine").findOne().click();
  } else {
    click(target);
  }
}
/**
 * 模拟点击不可以点击元素
 * @param {UiObject} target 控件或者是控件文本
 */
function my_click_non_clickable(target) {
  if (typeof (target) == 'string') {
    text(target).waitFor();
    var tmp = text(target).findOne().bounds();
  } else {
    var tmp = target.bounds();
  }
  var randomX = random(tmp.left, tmp.right);
  var randomY = random(tmp.top, tmp.bottom);
  click(randomX, randomY);
}
/**
 * 答题
 * @param {int} depth_option 选项控件的深度
 * @param {string} question 问题
 */
function do_contest_answer(depth_option, question) {
    if (question == "选择正确的读音" || question == "选择词语的正确词形" || question == "下列词形正确的是") {
        // 选择第一个
        className('android.widget.RadioButton').depth(depth_option).waitFor();
        className('android.widget.RadioButton').depth(depth_option).findOne().click();
    } else {
        var result;
        // 发送http请求获取答案 网站搜题速度 r1 > r2
        try {
            var r1 = http.get('http://www.syiban.com/search/index/init.html?modelid=1&q=' + encodeURI(question.slice(0, 10)));
            result = r1.body.string().match(/(答案：[A-Z]、)([^<]*?)(<)/);  // 匹配答案完整内容，去除选项编号的纯答案放在result[2]中
        } catch (error) {
        }
        // 如果第一个网站没获取到正确答案，则利用第二个网站
        if (!(result && result[0].charCodeAt(3) > 64 && result[0].charCodeAt(3) < 69)) {
            try {
                var r2 = http.get('https://www.souwen123.com/search/select.php?age=' + encodeURI(question.slice(0, 6)));
                result = r2.body.string().match(/(答案：[A-Z]、)([^<]*?)(<)/); // 匹配答案完整内容，去除选项编号的纯答案放在result[2]中
            } catch (error) {
            }
        }

        className('android.widget.RadioButton').depth(depth_option).waitFor();

        if (result) {
            var answer = result[2];
            log("找到在线答案：" + answer.toString())
            //获取回答选项数组
            var answerOptionsArray = new Array(0); //数组内容形式：[回答选项控件, 回答选项文字内容, 回答选项控件, ...]
            log('开始获取答案选项数组');
            className('android.widget.RadioButton')
                .depth(depth_option)
                .find()      //找到所有RadioButton元素
                .forEach(function (optionUIObject) {    //将每一个RadioButton元素及其代表的答案内容放入数组
                    answerOptionsArray.push(optionUIObject);
                    log('obj pushed!');
                    var optionText;
                    try {
                        optionText = optionUIObject.parent().child(1).text();  //尝试获得回答选项的文字内容（针对挑战答题）
                    } catch (error) {  // 直接获取选项文字不成功的情况（对战模式），则通过OCR获取
                        optionText = getObjectOcr(optionUIObject.parent().parent());
                    }
                    answerOptionsArray.push(optionText);

                    log('option text pushed: ' + optionText);
                    // toast('option text pushed: ' + ansText);
                });

            // 遍历选项数组，从中找到包含正确答案的元素
            var ansIndex = answerOptionsArray.findIndex(val => {
                try {
                    return val.includes(answer);
                } catch (error) {
                    return false;
                }
                // if (typeof val === 'string') {
                //     return val.includes(result[2]);
                // } else
                //     return false;
            });
            // 如果没找到答案（可能由于OCR错误），寻找最相似答案
            if (ansIndex == -1) {
                var max_similarity = 0;
                var max_similarity_index = 1;
                for (var i = 1; i < answerOptionsArray.length; i += 2) {
                    var similarity = getSimilarity(answerOptionsArray[i], answer);
                    if (similarity > max_similarity) {
                        max_similarity = similarity;
                        max_similarity_index = i;
                    }
                }
                ansIndex = max_similarity_index;
            }

            try {
                log('尝试点击答案选项...第 ' + (ansIndex + 1) / 2 + ' 个答案！');
                answerOptionsArray[ansIndex - 1].click();
            } catch (error) {
                // 如果选项不存在，则点击第一个
                log('选取答案失败，点击第一个答案');
                className('android.widget.RadioButton').depth(depth_option).findOne().click();
            }
        } else {
            // 如果没找到结果则选择第一个
            log('没有找到在线答案结果，点击第一个！');
            className('android.widget.RadioButton').depth(depth_option).findOne().click();
        }
    }
}

  
  /**
   * @param {image} img 传入图片
   */
  function ocr_api(img) {
    try {
      var answer = ocr.recognizeText(img);
    } catch (error) {
      toast("请将脚本升级至最新版");
      exit();
    }
  
  // 标点修改
  answer = answer.replace(/,/g, "，");
  answer = answer.replace(/〈〈/g, "《");
  answer = answer.replace(/〉〉/g, "》");
  answer = answer.replace(/\s*/g, "");
  answer = answer.replace(/_/g, "一");
  answer = answer.replace(/;/g, "；");
  answer = answer.replace(/o/g, "");
  answer = answer.replace(/。/g, "");
  answer = answer.replace(/`/g, "、");
  answer = answer.replace(/\?/g, "？");
  answer = answer.replace(/:/g, "：");
  answer = answer.replace(/!/g, "!");
  answer = answer.replace(/\(/g, "（");
  answer = answer.replace(/\)/g, "）");
  // OCR会输出英文的",但是如何转换是个问题，因为中文的引号“ ”是区分上下的。含引号的题目还是很多，尤其是一个题目里还有好几对“”。

  // 文字修改
  answer = answer.replace(/营理/g, "管理");
  answer = answer.replace(/土也/g, "地");
  answer = answer.replace(/未口/g, "和");
  answer = answer.replace(/晋查/g, "普查");
  answer = answer.replace(/扶悌/g, "扶梯");

  answer = answer.slice(answer.indexOf('.') + 1);
  answer = answer.slice(0, 10);
  return answer;
}
/**
 * 用于下面选择题
 * 获取2个字符串的相似度
 * @param {string} str1 字符串1
 * @param {string} str2 字符串2
 * @returns {number} 相似度 
 */
 function getSimilarity(str1, str2) {
    var sameNum = 0
    //寻找相同字符
    for (var i = 0; i < str1.length; i++) {
      for (var j = 0; j < str2.length; j++) {
        if (str1[i] === str2[j]) {
          sameNum++;
          break;
        }
      }
    }
    return sameNum / str2.length;
  }
/*
********************调用华为API实现ocr********************
*/

/**
 * 获取用户token
 */
function get_huawei_token() {
  var res = http.postJson(
    'https://iam.cn-south-1.myhuaweicloud.com/v3/auth/tokens',
    //'https://iam.cn-north-4.myhuaweicloud.com/v3/auth/tokens',
    {
      "auth": {
        "identity": {
          "methods": [
            "password"
          ],
          "password": {
            "user": {
              "name": username, //替换为实际用户名
              "password": password, //替换为实际的用户密码
              "domain": {
                "name": domainname //替换为实际账号名
              }
            }
          }
        },
        "scope": {
          "project": {
            "name": projectname //替换为实际的project name，如cn-north-4
          }
        }
      }
    },
    {
      headers: {
        'Content-Type': 'application/json;charset=utf8'
      }
    }
  );
  return res.headers['X-Subject-Token'];
}

if (whether_improve_accuracy == 'yes' && baidu_or_huawei == 'huawei') var token = get_huawei_token();


/**
* 华为ocr接口，传入图片返回文字
* @param {image} img 传入图片
* @returns {string} answer 文字
*/
function huawei_ocr_api(img) {
  var right_flag = false;
  var answer_left = "";
  var answer_right = "";
  var answer = "";
  var res = http.postJson(
    // 'https://' + endpoint + '/v2/' + projectId + '/ocr/web-image',
    'https://ocr.cn-south-1.myhuaweicloud.com/v2/' + projectId + '/ocr/web-image',
    //https://ocr.cn-south-1.myhuaweicloud.com/v2/{project_id}/ocr/web-image
    {
      "image": images.toBase64(img)
    },
    {
      headers: {
        "User-Agent": "API Explorer",
        "X-Auth-Token": token,
        "Content-Type": "application/json;charset=UTF-8"
      }
    }
  );
  var res = res.body.json();
  try {
    var words_list = res.result.words_block_list;
  } catch (error) {
  }
  if (words_list) {
    for (var i in words_list) {
      // 如果是选项则后面不需要读取
      if (words_list[i].words[0] == "A") break;
      // 将题目以分割线分为两块
      // 利用location之差判断是否之中有分割线
      /**
       * location:
       * 识别到的文字块的区域位置信息，列表形式，
       * 分别表示文字块4个顶点的（x,y）坐标；采用图像坐标系，
       * 图像坐标原点为图像左上角，x轴沿水平方向，y轴沿竖直方向。
       */
      if (words_list[0].words.indexOf('.') != -1 && i > 0 &&
        Math.abs(words_list[i].location[0][0] -
          words_list[i - 1].location[0][0]) > 100) right_flag = true;
      if (right_flag) answer_right += words_list[i].words;
      else answer_left += words_list[i].words;
      if (answer_left.length >= 20 || answer_right.length >= 20) break;
    }
  }
  // 取信息最多的块
  answer = answer_right.length > answer_left.length ? answer_right : answer_left;
  answer = answer.replace(/\s*/g, "");
  answer = answer.replace(/,/g, "，");
  answer = answer.slice(answer.indexOf('.') + 1);
  answer = answer.slice(0, 20);
  return answer;
  log(answer);
}

/*
********************调用百度API实现ocr********************
*/

/**
* 获取用户token
*/
function get_baidu_token() {
  var res = http.post(
    'https://aip.baidubce.com/oauth/2.0/token',
    {
      grant_type: 'client_credentials',
      client_id: AK,
      client_secret: SK
    }
  );
  return res.body.json()['access_token'];
}

if (whether_improve_accuracy == 'yes' && baidu_or_huawei == 'baidu') var token = get_baidu_token();

/**
* 百度ocr接口，传入图片返回文字
* @param {image} img 传入图片
* @returns {string} answer 文字
*/
function baidu_ocr_api(img) {
  var right_flag = false;
  var answer_left = "";
  var answer_right = "";
  var answer = "";
  var res = http.post(
    'https://aip.baidubce.com/rest/2.0/ocr/v1/general',
    //'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate', 
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      access_token: token,
      image: images.toBase64(img),
    }
  );
  var res = res.body.json();
  try {
    var words_list = res.words_result;
  } catch (error) {
  }
  if (words_list) {
    for (var i in words_list) {
      // 如果是选项则后面不需要读取
      if (words_list[i].words[0] == "A") break;
      // 将题目以分割线分为两块
      // 利用location之差判断是否之中有分割线
      /**
       * location:
       * 识别到的文字块的区域位置信息，列表形式，
       * location['left']表示定位位置的长方形左上顶点的水平坐标
       * location['top']表示定位位置的长方形左上顶点的垂直坐标
       */
      if (words_list[0].words.indexOf('.') != -1 && i > 0 &&
        Math.abs(words_list[i].location['left'] -
          words_list[i - 1].location['left']) > 100) right_flag = true;
      if (right_flag) answer_right += words_list[i].words;
      else answer_left += words_list[i].words;
      if (answer_left.length >= 20 || answer_right.length >= 20) break;
    }
  }
  answer = answer_right.length > answer_left.length ? answer_right : answer_left;
  answer = answer.replace(/\s*/g, "");
  answer = answer.replace(/,/g, "，");
  answer = answer.slice(answer.indexOf('.') + 1);
  answer = answer.slice(0, 20);
  return answer;
}

function do_it() {

    var min_pos_width = device.width;
    var min_pos_height = device.height;
  
    while (!text('开始').exists());
    while (!text('继续挑战').exists()) {
      className("android.view.View").depth(28).waitFor();
      var pos = className("android.view.View").depth(28).findOne().bounds();
      if (className("android.view.View").text("        ").exists())
        pos = className("android.view.View").text("        ").findOne().bounds();
      do {
        var point = findColor(captureScreen(), '#1B1F25', {
          region: [pos.left, pos.top, pos.width(), pos.height()],
          threshold: 10,
        });
      } while (!point);
  
      min_pos_width = Math.min(pos.width(), min_pos_width);
      min_pos_height = Math.min(pos.height(), min_pos_height);
      var img = images.clip(captureScreen(), pos.left, pos.top, min_pos_width, min_pos_height);
  
      if (whether_improve_accuracy == 'yes') {
        if (baidu_or_huawei == 'huawei') var question = huawei_ocr_api(img);
        else var question = baidu_ocr_api(img);
      }
      else var question = ocr_api(img);
  
      log(question);
      if (question) do_contest_answer(32, question);
      else {
        className('android.widget.RadioButton').depth(32).waitFor();
        className('android.widget.RadioButton').depth(32).findOne().click();
      }
      // 等待新题目加载
      while (!textMatches(/第\d题/).exists() && !text('继续挑战').exists() && !text('开始').exists());
    }
  }
  
  if (!className('android.view.View').depth(21).text('学习积分').exists()) {
    app.launchApp('学习强国');
    sleep(random_time(delay_time * 3));
    var while_count = 0;
    while (!id('comm_head_title').exists() && while_count < 5) {
      while_count++;
      back();
      sleep(random_time(delay_time));
    }
    app.launchApp('学习强国');
    sleep(random_time(delay_time));
    my_click_clickable('我的');
    my_click_clickable('学习积分');
  }
  
/*
**********四人赛*********
*/
if (four_player_battle == 'yes') {
  sleep(random_time(delay_time));
  className('android.view.View').depth(21).text('学习积分').waitFor();
  entry_model(11);
  for (var i = 0; i < count; i++) {
    sleep(random_time(delay_time));
    my_click_clickable('开始比赛');
    do_it();
    if (i == 0 && count == 2) {
      sleep(random_time(delay_time));
      while (!click('继续挑战'));
      sleep(random_time(delay_time));
    }
  }
  sleep(random_time(delay_time));
  back();
  sleep(random_time(delay_time));
  back();
}

/*
**********双人对战*********
*/
if (two_player_battle == 'yes') {
  sleep(random_time(delay_time));
  className('android.view.View').depth(21).text('学习积分').waitFor();
  entry_model(12);

  // 点击随机匹配
  text('随机匹配').waitFor();
  sleep(random_time(delay_time * 2));
  try {
    className('android.view.View').clickable(true).depth(24).findOnce(1).click();
  } catch (error) {
    className("android.view.View").text("").findOne().click();
  }
  do_it();
  sleep(random_time(delay_time));
  back();
  sleep(random_time(delay_time));
  back();
  my_click_clickable('退出');
}
if (text('我的').exists()) {
  my_click_clickable('我的');

}
if (text('学习积分').exists()) {
  my_click_clickable('学习积分');

}

/**
 * 获取控件对象的本地OCR结果
 * @param {UIObject} uiObj 
 * @returns {string} 本地OCR结果
 */
 function getObjectOcr(uiObj) {
    var pos = uiObj.bounds();
    log('starting capture screen...');
    var img = images.clip(captureScreen(), pos.left, pos.top, pos.width(), pos.height());
    log('ocr中....');
    try {
        var ans = ocr.ocrImage(img).text;
    } catch (error) {
        return undefined;
    }
    log('finished ocr! result: ' + ans);
    return ans;
}
if (pushplus_token) {


  // 获取今日得分
  var score = textStartsWith('今日已累积').findOne().text();
  score = score.match(/\d+/)
  sleep(random_time(delay_time));
  back();
  // 获取账号名
  var account = id('my_display_name').findOne().text();
  account = account.slice(0, 1);
  //toast(account);
  // 推送消息
  push_weixin_message(account, score);
}


//震动一秒
//device.vibrate(1000);
if (text('学习积分').exists()) {
  my_click_clickable('学习积分');

} else {
  home();
}


//震动两秒
device.cancelKeepingAwake();
device.vibrate(1000);
toast('脚本运行完成');

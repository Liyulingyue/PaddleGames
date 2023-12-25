from chat_llm import *
import gradio as gr
import random
from static_info import level_info


def fn_free_reset():
    return 10, 10, "", "", "请开始战斗！"

def fn_free_send(free_hp1, free_hp2, free_word1, free_word2, free_last_word1, free_last_word2):
    if free_hp1==0 or free_hp2==0:
        return free_hp1, free_hp2, "", "", "胜负已分，请重置环境开始对局"
    try:
        value1, value2, reason = get_damage_of_two_word(free_word1, free_word2, free_last_word1, free_last_word2)
    except:
        return free_hp1, free_hp2, free_last_word1, free_last_word2, "运行错误，请重试或改变招式名后重试"
    free_hp1 -= value2
    free_hp2 -= value1
    if free_hp1<=0: free_hp1 = 0
    if free_hp2<=0: free_hp2 = 0
    if free_hp1 == free_hp2 and free_hp1 == 0:
        return free_hp1, free_hp2, free_word1, free_word2, "平局！"
    elif free_hp1 == 0:
        return free_hp1, free_hp2, free_word1, free_word2, "胜者！玩家2！"
    elif free_hp2 == 0:
        return free_hp1, free_hp2, free_word1, free_word2, "胜者！玩家1！"
    else:
        return free_hp1, free_hp2, free_word1, free_word2, f"玩家1造成伤害{value1}, 玩家2造成伤害{value2}, 伤害评分理由为：{reason}"


def fn_fight_reset():
    return 10, 10, "", "", "请开始战斗！"

def fn_fight_send(fight_hp1, fight_hp2, fight_word1, fight_last_word1, fight_last_word2):
    if fight_hp1==0 or fight_hp2==0:
        return fight_hp1, fight_hp2, "", "", "胜负已分，请重置环境开始对局"
    try:
        fight_word2 = get_name_of_word(fight_last_word1)
        value1, value2, reason = get_damage_of_two_word(fight_word1, fight_word2, fight_last_word1, fight_last_word2)
    except:
        return fight_hp1, fight_hp2, "", "", "运行错误，请重试或改变招式名后重试"
    fight_hp1 -= value2
    fight_hp2 -= value1
    if fight_hp1<=0: fight_hp1 = 0
    if fight_hp2<=0: fight_hp2 = 0
    if fight_hp1 == fight_hp2 and fight_hp1 == 0:
        return fight_hp1, fight_hp2, fight_word1, fight_word2, "平局！"
    elif fight_hp1 == 0:
        return fight_hp1, fight_hp2, fight_word1, fight_word2, "胜者！电脑！您败了！"
    elif fight_hp2 == 0:
        return fight_hp1, fight_hp2, fight_word1, fight_word2, "胜者！玩家！您胜了！"
    else:
        return fight_hp1, fight_hp2, fight_word1, fight_word2, f"玩家1造成伤害{value1}, 玩家2造成伤害{value2}, 伤害评分理由为：{reason}"

def fn_level_reset():
    return 10, 10, "", "", "请开始战斗！", gr.update(visible=False)

def fn_level_send(level_hp1, level_hp2, level_word1, level_last_word1, level_last_word2, level_number):
    if level_hp1!=0 and level_hp2==0:
        return level_hp1, level_hp2, "", "", "胜负已分，请重置环境或进入下一关", gr.update(visible=True)
    elif level_hp1==0 or level_hp2==0:
        return level_hp1, level_hp2, "", "", "胜负已分，请重置环境重新对局", gr.update(visible=False)

    if level_word1=="__SIMPLE_WIN__":
        return level_hp1, level_hp2, "", "", "胜者！玩家！您胜了！", gr.update(visible=True)

    try:
        level_word2 = get_name_of_word(level_last_word1)
        value1, value2, reason = get_damage_of_two_word(level_word1, level_word2, level_last_word1, level_last_word2)
    except:
        return level_hp1, level_hp2, "", "", "运行错误，请重试或改变招式名后重试", gr.update(visible=False)

    if level_number==2:
        value1 *= 0.8
    elif level_number==3:
        value2 *= 1.2
    elif level_number==4:
        if random.random() < 0.2:
            value1 = 0
    elif level_number==5:
        level_hp2 += (value2*0.2)
    elif level_number==6:
        if len(level_word2)==5:
            value2 *=2
    elif level_number==7:
        if level_hp2<3:
            value2 *=3
    elif level_number==8:
        level_hp1 -= (value1*0.2)
    elif level_number==9:
        pass
    elif level_number==10:
        value1 *= 0.8
        value2 *= 1.2
        if random.random() < 0.1:
            value1 = 0
    else:
        pass
    
    level_hp1 -= value2
    level_hp2 -= value1
    if level_hp1<=0: level_hp1 = 0
    if level_hp2<=0: level_hp2 = 0
    if level_hp1>=10: level_hp1 = 10
    if level_hp2>=10: level_hp2 = 10
    
    if level_hp1 == level_hp2 and level_hp1 == 0:
        return level_hp1, level_hp2, level_word1, level_word2, "平局！", gr.update(visible=False)
    elif level_hp1 == 0:
        return level_hp1, level_hp2, level_word1, level_word2, "胜者！电脑！您败了！", gr.update(visible=False)
    elif level_hp2 == 0:
        if level_hp1>1 and level_number==9:
            return level_hp1, level_hp2, level_word1, level_word2, "平局！", gr.update(visible=False)
        return level_hp1, level_hp2, level_word1, level_word2, "胜者！玩家！您胜了！", gr.update(visible=True)
    else:
        return level_hp1, level_hp2, level_word1, level_word2, f"玩家1造成伤害{value1}, 玩家2造成伤害{value2}, 伤害评分理由为：{reason}", gr.update(visible=False)

def fn_level_next(level_number):
    if level_number == 10:
        return 10, 10, "", "", "大师！您已经超越了一切！", gr.update(visible=True), level_number, "# 大师！您已经超越了一切！"
    level_number = level_number+1
    level_title = \
        f"""
        # 第{int(level_number)}关 {level_info[int(level_number)][0]}
        {level_info[int(level_number)][1]}
        ***
        """
    return 10, 10, "", "", "请开始战斗！", gr.update(visible=False), level_number, level_title


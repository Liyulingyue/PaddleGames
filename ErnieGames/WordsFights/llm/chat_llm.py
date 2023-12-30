import erniebot
import json
import datetime
# 一个自定义文件用来存放token，请自行到自己账号主页复制自己的token替换erniebot
from .tokens import erniebot_access_token

def get_llm_answer(prompt):
    erniebot.api_type = 'aistudio'
    erniebot.access_token = erniebot_access_token
    response = erniebot.ChatCompletion.create(
        model='ernie-bot',
        messages=[{'role': 'user', 'content': prompt}],
    )
    result = response.get_result()
    return result

def extract_json_from_llm_answer(result):
    s_id = result.index('```json')
    e_id = result.index('```', s_id+7)
    json_str = result[s_id+7:e_id]
    json_dict = json.loads(json_str)
    return json_dict

def get_damage_of_a_word(word1, pre_word1):
    prompt = \
    f"""
    你是一个伤害判断机器人，你可以根据给出的招式名称，评价这个招式能够给对方造成的伤害值。
    这个招式造成的伤害取决于招式的含义、名称等等因素，你需要非常具有发散性思维来考虑并给出具体的伤害数值。有些招式造成的伤害会非常低，有些则非常高。
    此外，如果这次的招式名称和上次使用的招式名称<{pre_word1}>很类似，可能造成的伤害很低。
    招式名称是<{word1}>，
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "造成的伤害":float, 
    "评分理由":str
    {str('}')}
    其中，伤害数值取值范围是0到1。
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    value1 = json_dict['造成的伤害']
    if value1 > 2:
        value1 = 1/value1
    elif value1 > 1:
        value1 = value1 - 1
    elif value1 < 0:
        value1 = 0
    else:
        value1 = value1
    reason = json_dict['评分理由']
    return value1, reason

def get_percent_of_a_word(word1, word2):
    prompt = \
    f"""
    你是一个伤害判断机器人，你可以根据给出的招式名称，以及对手使用的招式名称，评价这个招式能够给对手造成的伤害的增益系数。
    这个招式给对方造成的伤害系数取决于双方招式的名称含义，克制关系。你需要非常具有发散性思维来考虑并给出具体的伤害系数。有些招式的系数会非常低，有些则非常高。
    例如：对方使用了防御力很高的招式，可能导致我方造成的伤害系数非常低（低于1，最低不低于0）；我方招式能克制对方，比如水克火，会导致我方的伤害系数很高（高于1，最高不超过2）；如果双方的克制关系没有非常明确，增益系数应当为1。
    伤害系数越低（小于1），表明我方造成的伤害越小，对方能有效防御我的招式；系数越大(大于1)，表明我方造成的伤害越大。
    我方招式名称是<{word1}>，对方招式名称是<{word2}>。
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "我方的伤害系数":float, 
    "评分理由":str
    {str('}')}
    其中，伤害系数取值范围是0到2。
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    value1 = json_dict['我方的伤害系数']
    if value1 > 3:
        value1 = 1/value1
    elif value1 > 2:
        value1 = value1 - 1
    elif value1 < 0:
        value1 = 0
    else:
        value1 = value1
    reason = json_dict['评分理由']
    return value1, reason

'''
def get_damage_of_a_word(word1, pre_word1):
    prompt = \
    f"""
    你是一个伤害判断机器人，你可以根据给出的招式名称，评价这个招式能够给对方造成的伤害值。
    这个招式造成的伤害取决于招式的含义、名称等等因素，你需要非常具有发散性思维来考虑并给出具体的伤害数值。有些招式造成的伤害会非常低，有些则非常高。
    此外，如果这次的招式名称和上次使用的招式名称<{pre_word1}>很类似，可能造成的伤害很低。
    招式名称是<{word1}>，
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "造成的伤害":float, 
    "评分理由":str
    {str('}')}
    其中，伤害数值取值范围是0到1。
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    value1 = json_dict['造成的伤害']
    if value1 > 2:
        value1 = 1/value1
    elif value1 > 1:
        value1 = value1 - 1
    elif value1 < 0:
        value1 = 0
    else:
        value1 = value1
    reason = json_dict['评分理由']
    return value1, reason
'''

'''
def get_damage_of_two_word(word1, word2):
    prompt = \
    f"""
    你是一个伤害判断机器人，你可以根据玩家给出的招式名称，评价这两个招式能够给对方造成的伤害值。
    这两个招式造成的伤害取决于招式的含义、两个招式交互关系等等因素，你需要非常具有发散性思维来考虑并给出具体的伤害数值。
    用户一给出的招式是<{word1}>，
    用户二给出的招式是<{word2}>。
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "用户一造成的伤害":float, 
    "用户二造成的伤害":float,
    "评分理由":str
    {str('}')}
    其中，伤害数值为介于0到1之间的浮点数
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    value1 = json_dict['用户一造成的伤害']
    value2 = json_dict['用户二造成的伤害']
    reason = json_dict['评分理由']
    return value1, value2, reason
'''

def get_damage_of_two_word(word1, word2, pre_word1, pre_word2):
    value1, reason1 = get_damage_of_a_word(word1, pre_word1) 
    value2, reason2 = get_damage_of_a_word(word2, pre_word2) 
    value1_percent, reason1_precent = get_percent_of_a_word(word1, word2)
    value2_percent, reason2_percent = get_percent_of_a_word(word2, word1)
    return value1*value1_percent, value2*value2_percent, f"{word1}的评分理由：{reason1+reason1_precent}\n{word2}的评分理由：{reason2+reason2_percent}\n"

def get_name_of_word(word1=None):
    prompt = \
    f"""
    你是一个招式生成器，你将随机生成一个招式名称。现在时间是{datetime.datetime.now().strftime("%Y-%m-%d_%H:%M:%S")}。
    上次对手出招招式名称是<{word1}>，你的新招式可以克制对手，也可以不克制。
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "招式名称":str
    {str('}')}
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    word2 = json_dict['招式名称']
    return word2


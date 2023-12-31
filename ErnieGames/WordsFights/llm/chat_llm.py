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

def analyse_word(word):
    prompt = \
    f"""
    你是一个属性判断机器人，你可以根据给出的<阵型>名称，评价这个<阵型>对应的攻击力、防御力以及属性值。
    这个<阵型>对应的攻击力、防御力和属性取决于招式的含义、名称等等因素，你需要非常具有发散性思维来考虑并给出具体的判断。
    有些招式造成的伤害会非常低，有些则非常高。
    <阵型>名称是<{word}>，
    请以Json形式给出回复，Json返回的内容格式为：
    {str('{')}"
    "攻击力":float,
    "防御力":float, 
    "属性":str
    {str('}')}
    其中，攻击力的取值是2到3，防御力的取值是0到1，属性的取值范围是"金","木","水","火","土"之一。
    """
    result = get_llm_answer(prompt)
    json_dict = extract_json_from_llm_answer(result)
    ATK = json_dict['攻击力']
    DEF = json_dict['防御力']
    element = json_dict["属性"]
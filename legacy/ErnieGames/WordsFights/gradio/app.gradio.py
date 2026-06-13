import os
# os.system("pip install --upgrade erniebot")

import gradio as gr
from gr_functions import *
from static_info import *

with gr.Blocks() as demo:
    gr.Markdown(intro_str_title)
    with gr.Tab("对战模式"):
        gr.Markdown(intro_str_battle2robot)
        fight_hint = gr.Markdown("请输入招式开始战斗")
        with gr.Row():
            fight_hp1 = gr.Slider(0, 10, value=10, label="玩家的生命值",interactive=False)
            fight_hp2 = gr.Slider(0, 10, value=10, label="电脑的生命值",interactive=False)
        with gr.Row():
            fight_last_word1 = gr.Text(label="玩家上一次的招式", interactive=False)
            fight_last_word2 = gr.Text(label="电脑上一次的招式", interactive=False)
        with gr.Row():
            fight_word1 = gr.Text(label="请输入您的招式")
            with gr.Column():
                fight_send = gr.Button("发送招式")
                fight_reset = gr.Button("重置环境")
        fight_send.click(fn=fn_fight_send, inputs=[fight_hp1, fight_hp2, fight_word1, fight_last_word1, fight_last_word2], outputs=[fight_hp1, fight_hp2, fight_last_word1, fight_last_word2, fight_hint])
        fight_reset.click(fn=fn_fight_reset, outputs=[fight_hp1, fight_hp2, fight_last_word1, fight_last_word2, fight_hint])
    with gr.Tab("闯关模式"):
        gr.Markdown(intro_str_battle_in_level)
        level_title = gr.Markdown(
            """
            # 第1关 一切依旧
            所有一切都毫无变化
            ***
            """)
        level_hint = gr.Markdown("请输入招式开始战斗")
        with gr.Row():
            level_hp1 = gr.Slider(0, 10, value=10, label="玩家的生命值",interactive=False)
            level_hp2 = gr.Slider(0, 10, value=10, label="电脑的生命值",interactive=False)
        with gr.Row():
            level_last_word1 = gr.Text(label="玩家上一次的招式", interactive=False)
            level_last_word2 = gr.Text(label="电脑上一次的招式", interactive=False)
        with gr.Row():
            level_word1 = gr.Text(label="请输入您的招式")
            with gr.Column():
                level_send = gr.Button("发送招式")
                level_reset = gr.Button("重置环境")
        level_number = gr.Number(value=1, visible=False)
        level_next = gr.Button("进入下一关", visible=False)
        level_send.click(fn=fn_level_send, inputs=[level_hp1, level_hp2, level_word1, level_last_word1, level_last_word2, level_number], outputs=[level_hp1, level_hp2, level_last_word1, level_last_word2, level_hint, level_next])
        level_reset.click(fn=fn_level_reset, outputs=[level_hp1, level_hp2, level_last_word1, level_last_word2, level_hint, level_next])
        level_next.click(fn=fn_level_next, inputs=[level_number], outputs=[level_hp1, level_hp2, level_last_word1, level_last_word2, level_hint, level_next, level_number, level_title])
    with gr.Tab("自由对战模式"):
        gr.Markdown(intro_str_battle2robot)
        free_hint = gr.Markdown("请输入招式开始战斗")
        with gr.Row():
            free_hp1 = gr.Slider(0, 10, value=10, label="玩家1的生命值",interactive=False)
            free_hp2 = gr.Slider(0, 10, value=10, label="玩家2的生命值",interactive=False)
        with gr.Row():
            free_last_word1 = gr.Text(label="玩家1上一次的招式", interactive=False)
            free_last_word2 = gr.Text(label="电脑2上一次的招式", interactive=False)
        with gr.Row():
            free_word1 = gr.Text(label="请输入您的招式")
            free_word2 = gr.Text(label="请输入您的招式")
        free_send = gr.Button("发送招式")
        free_reset = gr.Button("重置环境")
        free_send.click(fn=fn_free_send, inputs=[free_hp1, free_hp2, free_word1, free_word2, free_last_word1, free_last_word2], outputs=[free_hp1, free_hp2, free_last_word1, free_last_word2, free_hint])
        free_reset.click(fn=fn_free_reset, outputs=[free_hp1, free_hp2, free_last_word1, free_last_word2, free_hint])

demo.launch()

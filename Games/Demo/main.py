#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Thanks to
https://blog.csdn.net/u014453898/article/details/88083173
https://github.com/maicss/PyQt-Chinese-tutorial
https://maicss.gitbooks.io/pyqt5/content/
zetcode.com
"""
from GameObject import *

import copy
import sys
import cv2
import numpy as np
import math
import sys
from PyQt5.QtWidgets import QWidget, QDesktopWidget, QApplication, QPushButton, QFileDialog, QLabel, QTextEdit, \
    QGridLayout, QFrame, QColorDialog, QMessageBox
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QColor, QImage, QPixmap
import fastdeploy

class Window(QWidget):

    def __init__(self):
        super().__init__()

        self.game_obj = GameObject()
        self.keypoints = None

        self.initModel()
        self.initCamera()
        self.initClock()
        self.initUI()

    def initUI(self):

        grid = QGridLayout()
        self.setLayout(grid)

        self.Game_Box = QLabel()  # 定义显示视频的Label
        self.Game_Box.setFixedSize(500, 500)
        grid.addWidget(self.Game_Box, 0, 0, 20, 20)
        self.Game_Box.setMouseTracking(True)

        self.Pred_Box = QLabel()  # 定义显示视频的Label
        self.Pred_Box.setFixedSize(500, 500)
        grid.addWidget(self.Pred_Box, 0, 20, 20, 20)

        self.setWindowTitle('test')
        self.show()

    def initClock(self):
        # 通过定时器读取数据
        self.flush_clock = QTimer()  # 定义定时器，用于控制显示视频的帧率
        self.flush_clock.start(30)   # 定时器开始计时30ms，结果是每过30ms从摄像头中取一帧显示
        self.flush_clock.timeout.connect(self.updata_frame)  # 若定时器结束，show_frame()

    def initCamera(self):
        # 开启视频通道
        self.camera_id = 0 # 为0时表示视频流来自摄像头
        self.camera = cv2.VideoCapture()  # 视频流
        self.camera.open(self.camera_id)

    def initModel(self):
        self.model = fastdeploy.vision.keypointdetection.PPTinyPose('../../Models/PP_TinyPose_128x96_infer/model.pdmodel',
                                                                    '../../Models/PP_TinyPose_128x96_infer/model.pdiparams',
                                                                    '../../Models/PP_TinyPose_128x96_infer/infer_cfg.yml')

    def inferModel(self):
        # read pic from camera
        _, img = self.camera.read()  # 从视频流中读取
        img = cv2.flip(img, 1) # 摄像头画面反转
        img2 = cv2.resize(img, (500, 500))  # 把读到的帧的大小重新设置为 640x480
        showPic = QImage(img2, img2.shape[1], img2.shape[0], QImage.Format_BGR888)
        self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        try:
            result = self.model.predict(img)
            self.keypoints = result.keypoints

            # 模糊
            img = cv2.resize(img, (40, 40))
            img = cv2.resize(img, (640, 640), interpolation=cv2.INTER_NEAREST)

            showPic = QImage(img, img.shape[1], img.shape[0], QImage.Format_BGR888)
            self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        except:
            pass


    def updata_frame(self):
        self.inferModel() # infer and show



        # update balance
        self.game_obj.update(self.keypoints)

        # 绘制游戏窗口
        img = self.game_obj.draw_canvas()
        showPic = QImage(img, 500, 500, QImage.Format_BGR888)
        self.Game_Box.setPixmap(QPixmap.fromImage(showPic))

        # 游戏结束
        state, score = self.game_obj.get_game_state()
        if state: # 游戏结束
            QMessageBox.information(self,
                                    "Oops！",
                                    "游戏结束！\n您的分数是" + str(score),
                                    QMessageBox.Yes)
            self.game_obj.__init__()


if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = Window()
    sys.exit(app.exec_())
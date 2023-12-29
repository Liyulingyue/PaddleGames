#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Thanks to
https://blog.csdn.net/u014453898/article/details/88083173
https://github.com/maicss/PyQt-Chinese-tutorial
https://maicss.gitbooks.io/pyqt5/content/
zetcode.com
"""
import sys
import cv2
from PyQt5.QtWidgets import QWidget, QApplication, QPushButton, QLabel, QGridLayout, QLineEdit
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QImage, QPixmap
import fastdeploy
import keyboard

class Window(QWidget):

    def __init__(self):
        super().__init__()

        self.run_flag = False
        self.next_key = None

        self.initModel()
        self.initCamera()
        self.initClock()
        self.initUI()


    def initUI(self):

        grid = QGridLayout()
        self.setLayout(grid)

        grid.addWidget(QLabel('指定操作框体', self), 0, 0, 1, 2)
        grid.addWidget(QLabel('xmin', self), 1, 0, 1, 1)
        grid.addWidget(QLabel('ymin', self), 2, 0, 1, 1)
        grid.addWidget(QLabel('xlen', self), 3, 0, 1, 1)
        grid.addWidget(QLabel('ylen', self), 4, 0, 1, 1)
        self.checkbox_xmin = QLineEdit(str(int(QApplication.desktop().screenGeometry().width()/2-50)))
        self.checkbox_ymin = QLineEdit(str(int(QApplication.desktop().screenGeometry().height()/2-50)))
        self.checkbox_xlen = QLineEdit("100")
        self.checkbox_ylen = QLineEdit("100")
        grid.addWidget(self.checkbox_xmin, 1, 1, 1, 1)
        grid.addWidget(self.checkbox_ymin, 2, 1, 1, 1)
        grid.addWidget(self.checkbox_xlen, 3, 1, 1, 1)
        grid.addWidget(self.checkbox_ylen, 4, 1, 1, 1)

        button = QPushButton("开启监听")
        grid.addWidget(button, 5, 1, 1, 1)
        button.clicked.connect(self.run_program)

        self.pred_box = QLabel()  # 定义显示视频的Label
        self.pred_box.setFixedSize(600, 400) # w, h
        grid.addWidget(self.pred_box, 6, 0, 1, 2)

        self.setWindowTitle('WeChatBot')
        self.show()

    def initClock(self):
        # 通过定时器读取数据
        self.flush_clock = QTimer()  # 定义定时器，用于控制显示视频的帧率
        self.flush_clock.start(30)   # 定时器开始计时30ms，结果是每过30ms从摄像头中取一帧显示
        self.flush_clock.timeout.connect(self.update_frame)  # 若定时器结束，show_frame()

    def initModel(self):
        self.model = fastdeploy.vision.keypointdetection.PPTinyPose('../../Models/PP_TinyPose_128x96_infer/model.pdmodel',
                                                                    '../../Models/PP_TinyPose_128x96_infer/model.pdiparams',
                                                                    '../../Models/PP_TinyPose_128x96_infer/infer_cfg.yml')
    def initCamera(self):
        # 开启视频通道
        self.camera_id = 0 # 为0时表示视频流来自摄像头
        self.camera = cv2.VideoCapture()  # 视频流
        self.camera.open(self.camera_id)

    def run_program(self):
        self.run_flag = True

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Y: self.run_flag = False

    def inferModel(self):
        # read pic from camera
        _, img = self.camera.read()  # 从视频流中读取
        img = cv2.flip(img, 1) # 摄像头画面反转
        img2 = cv2.resize(img, (600, 400))  # 把读到的帧的大小重新设置为 640x480
        showPic = QImage(img2, img2.shape[1], img2.shape[0], QImage.Format_BGR888)
        self.pred_box.setPixmap(QPixmap.fromImage(showPic))

        try:
            result = self.model.predict(img)

            # 退出判定
            top_y = result.keypoints[9][1]
            top_x = result.keypoints[9][0]
            bottom_y = result.keypoints[10][1]
            bottom_x = result.keypoints[10][0]

            if abs(top_x-bottom_x) + abs(top_y-bottom_y) < 30:
                self.run_flag = False

            if abs(result.keypoints[9][1]-result.keypoints[6][1])+abs(result.keypoints[9][0]-result.keypoints[6][0]) < 30:
                self.next_key = 'w'

        except:
            # print('infer error')
            pass

    def update_frame(self):
        if self.run_flag:
            self.inferModel()

            # pyautogui.moveTo(int(self.checkbox_xmin.text()), int(self.checkbox_ymin.text()), duration=0)
            # pyautogui.click(clicks=2,button='left',interval=0.1)
            # pyautogui.hotkey('w')  # 粘贴9
            # pyautogui.keyDown('w')
            # pydirectinput.keyDown('w')
            if self.next_key != None:
                keyboard.press_and_release(self.next_key)
                print(self.next_key)
                self.next_key = None
            # self.run_flag = False

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = Window()
    sys.exit(app.exec_())

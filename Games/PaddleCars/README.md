# PaddleCars 基于FastDeploy的飙车小游戏

本项目基于pp-tinypose和Fastdeploy识别手腕位置，模拟方向盘转动，控制小车在道路上移动，躲避障碍车辆。

## 游戏介绍和效果展示

左侧是游戏画面，右侧是人物和检测结果。程序检测身上的关键点位置（手腕），并计算偏移角度作为小车移动的方向和速度，并躲避障碍物。

游戏开始的方式采用了非常帅气的双手交叉变身姿势 = w <，撞车会显示这次的游戏时间作为得分，双手再次交叉即可重新开始游戏~

<iframe src="//player.bilibili.com/player.html?aid=568306263&bvid=BV19v4y187pZ&cid=1048759384&page=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" height="500" width="800"> </iframe>

## 环境准备
运行本项目需要准备：PC（带有CPU即可），USB摄像头（笔记本自带的摄像头也可以）。
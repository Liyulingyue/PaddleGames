import cv2
import json


def get_img_and_resize(config_dict, key, width=1600, height=900):
    fig_path, x, y, w, h = config_dict[key]
    w = int(w * height) if w < 1 else w
    h = int(h * height) if h < 1 else h
    img = cv2.imread(fig_path)
    img = cv2.resize(img, (w, h))
    return img


def paste_image(img1, img2, position_percent):
    # 获取img1和img2的尺寸
    height1, width1, _ = img1.shape
    height2, width2, _ = img2.shape
    # 计算粘贴位置的中心点
    center_x = int(width1 * position_percent[0])
    center_y = int(height1 * position_percent[1])
    # 计算粘贴的起始位置
    x_offset = max(0, center_x - width2 // 2)
    y_offset = max(0, center_y - height2 // 2)
    # 根据实际粘贴位置调整截取的第二张图片的区域
    src_x = max(0, width2 // 2 - (center_x - x_offset))
    src_y = max(0, height2 // 2 - (center_y - y_offset))
    # 计算实际粘贴的区域大小
    paste_width = min(width2, width1 - x_offset) - src_x
    paste_height = min(height2, height1 - y_offset) - src_y

    if paste_width > 0 and paste_height > 0:  # 确保有内容可以粘贴
        # 只粘贴部分画面到img1
        img1[y_offset:y_offset + paste_height, x_offset:x_offset + paste_width] = \
            img2[src_y:src_y + paste_height, src_x:src_x + paste_width]
    return img1

def round_floats_in_dict(d, precision=3):
    """
    递归地遍历字典中的所有浮点数值，并将它们设置为指定的小数位数。
    """
    rounded_dict = {}
    for key, value in d.items():
        if isinstance(value, dict):
            # 如果值是另一个字典，递归调用此函数
            rounded_value = round_floats_in_dict(value, precision)
        elif isinstance(value, float):
            # 如果值是浮点数，设置其精度
            rounded_value = round(value, precision)
        else:
            # 对于非浮点数和非字典的值，保持不变
            rounded_value = value
        rounded_dict[key] = rounded_value  # 将处理后的值添加到新字典中
    return rounded_dict
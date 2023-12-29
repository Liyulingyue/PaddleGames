import cv2

def get_img_and_resize(config_dict, key, width=1600, height=900):
    fig_path, x, y, w, h = config_dict[key]
    w = int(w * height) if w < 1 else w
    h = int(h * height) if h < 1 else h
    img = cv2.imread(fig_path)
    img = cv2.resize(img, (w,h))
    return img


def paste_image(img1, img2, position_percent):
    # 获取img1和img2的尺寸
    height1, width1 = img1.shape[:2]
    height2, width2 = img2.shape[:2]
    # 计算粘贴位置
    x_offset = int(width1 * position_percent[0] - width2 / 2)
    y_offset = int(height1 * position_percent[1] - height2 / 2)
    img1[y_offset:y_offset + height2, x_offset:x_offset + width2] = img2
    return img1
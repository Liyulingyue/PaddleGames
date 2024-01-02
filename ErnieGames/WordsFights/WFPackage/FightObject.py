import json
import math
import copy
from .utils import FloatPrecisionEncoder

# TODO: 死亡玩家不需要进行prompt检验
class FightObject(object):
    def __init__(self, time_step=0.1, damage_coefficient=0.5):
        super().__init__()
        self.data = self.init_data()
        self.time_step = time_step # 每次运行update时，间隔的时间
        self.damage_coefficient = damage_coefficient # 每一点面板伤害值，一秒内造成的伤害为0.5

    def init_data(self):
        data = FightObject._init_data()
        return data

    @staticmethod
    def _init_data():
        data = {}
        for user in ["User1", "User2"]:
            data[user] = {}
            for role in ["Soldier", "Rider", "Archer"]:
                data[user][role] = {}
                data[user][role]["hp"] = 100
                data[user][role]["x"] = 0.1 if user == "User1" else 0.9
                data[user][role]["y"] = 0.3 if role == "Soldier" else 0.5 if role == "Rider" else 0.7
                data[user][role]["target_x"] = data[user][role]["x"]
                data[user][role]["target_y"] = data[user][role]["y"]
                data[user][role]["prompt"] = ""  # 空意味着无阵法
                data[user][role]["ATK"] = 2
                data[user][role]["DEF"] = 1
                data[user][role]["element"] = ""  # 无阵法时无属性
        return data

    def update(self):
        # 所有士兵向目的地移动（增加移动速度的配置信息）
        self._update_position()

        # 所有士兵检索最近一个地方单位，进行攻击，扣除相应单位血量，需要按照属性计算克制关系
        self._update_hp("User1", "User2")
        self._update_hp("User2", "User1")

    def _update_position(self):
        # 所有士兵向目的地移动（增加移动速度的配置信息）
        # TODO: 增加碰撞信息，避免所有个体拥挤在一起
        for user in self.data:
            for role in self.data[user]:
                x = self.data[user][role]["x"]
                y = self.data[user][role]["y"]
                target_x = self.data[user][role]["target_x"]
                target_y = self.data[user][role]["target_y"]
                hp = self.data[user][role]["hp"]
                if (hp <= 0) or (x == target_x and y == target_y):
                    continue  # pass role with no hp or already in target position
                else:
                    speed_per_second = self._get_speed_of_role(role)
                    max_move_distance = speed_per_second * self.time_step
                    new_x, new_y = self._move_2d(x, y, target_x, target_y, max_move_distance)
                    self.data[user][role]["x"] = new_x
                    self.data[user][role]["y"] = new_y

    def _update_hp(self, base_user, another_user):
        for role in self.data[base_user]:
            nearest_role = ""
            nearest_distance = 2  # the max distance is sqrt(2)
            x = self.data[base_user][role]["x"]
            y = self.data[base_user][role]["y"]
            target_x = self.data[base_user][role]["target_x"]
            target_y = self.data[base_user][role]["target_y"]
            hp = self.data[base_user][role]["hp"]
            ranger = self._get_ranger_of_role(role)
            # if (hp <= 0) or (x != target_x or y != target_y):
            if (hp <= 0):
                continue  # pass role with no hp (后续可能考虑运动不能攻击)
            for role_ in self.data[another_user]:
                x_ = self.data[another_user][role_]["x"]
                y_ = self.data[another_user][role_]["y"]
                target_x_ = self.data[another_user][role_]["target_x"]
                target_y_ = self.data[another_user][role_]["target_y"]
                hp_ = self.data[another_user][role_]["hp"]
                if (hp_ <= 0):
                    continue  # pass role with no hp
                distance = math.sqrt((x - x_) ** 2 + (y - y_) ** 2)
                if ranger < distance:
                    continue
                else:
                    if distance < nearest_distance:
                        nearest_distance = distance
                        nearest_role = role_
            if nearest_role in ["Soldier", "Rider", "Archer"]:
                ATK = self.data[base_user][role]["ATK"]
                DEF_ = self.data[another_user][nearest_role]["DEF"]
                element = self.data[base_user][role]["element"]
                element_ = self.data[another_user][role]["element"]
                damage = max(0, ATK - DEF_)
                if (element=="金" and element_=="木") or \
                    (element == "木" and element_ == "土") or \
                    (element == "土" and element_ == "水") or \
                    (element == "水" and element_ == "火") or \
                    (element == "火" and element_ == "金"):
                    damage = damage * 2
                real_damage = damage * self.damage_coefficient * self.time_step
                hp_ = self.data[another_user][nearest_role]["hp"]
                hp_ = hp_ - real_damage
                # TODO: 增加更多的伤害交互
                self.data[another_user][nearest_role]["hp"] = hp_

    def set_prompt_info(self, user, role, **kwargs):
        for key in ["prompt", "ATK", "DEF", "element"]:
            self.data[user][role][key] = kwargs[key] if key in kwargs else self.data[user][role][key]

    def set_target_pos(self, user, role, target_pos):
        # TODO: 需要增加检测，避免两个士兵移动到相同的位置，从而重叠
        # 也许不需要增加这个选择，因为可以通过头像选中
        # TODO: 可以返回一段STR作为回执，例如告诉玩家移动失败
        # target_pos = [target_x, target_y]
        self.data[user][role]["target_x"] = target_pos[0]
        self.data[user][role]["target_y"] = target_pos[1]

    def get_dispatched_str(self):
        dispatched_dict = FightObject._data2dispatched_dict(self.data)
        dispatched_str = json.dumps(dispatched_dict, cls=FloatPrecisionEncoder, precision=4) # 保留4位小数
        return dispatched_str

    @staticmethod
    def _data2dispatched_dict(data):
        """
        TODO: 从数据安全角度来说，不应该将整个信息传递回去，暂时为了方便直接传递整个数据
        dispatched_dict = {}
        for user in ["User1", "User2"]:
            dispatched_dict[user] = {}
            for role in ["Soldier", "Rider", "Archer"]:
                dispatched_dict[user][role] = [data[user][role]["hp"],
                                               data[user][role]["x"],
                                               data[user][role]["y"],
                                               data[user][role]["target_x"],
                                               data[user][role]["target_y"],
                                               data[user][role]["prompt"]]
        """
        dispatched_dict = copy.deepcopy(data)
        return dispatched_dict

    def _get_speed_of_role(self, role):
        if role == "Soldier":
            speed = 1/60
        elif role == "Archer":
            speed = 1/60
        elif role == "Rider":
            speed = 1/60*1.5
        else:
            speed = 1/60
        return speed

    def _get_ranger_of_role(self, role):
        if role == "Soldier":
            ranger = 0.15
        elif role == "Archer":
            ranger = 0.25
        elif role == "Rider":
            ranger = 0.15
        else:
            ranger = 0.15
        return ranger

    def _move_2d(self, x, y, target_x, target_y, move_distance):
        # 计算当前位置到目标位置的距离
        distance = math.sqrt((target_x - x) ** 2 + (target_y - y) ** 2)

        # 如果距离小于或等于速度，则直接到达目标位置
        if distance <= move_distance:
            new_x, new_y = target_x, target_y
        else:
            # 计算移动的方向向量
            dx = target_x - x
            dy = target_y - y
            # 归一化方向向量
            direction = [dx / distance, dy / distance]
            # 根据速度计算新的位置
            new_x = x + direction[0] * move_distance
            new_y = y + direction[1] * move_distance
        return new_x, new_y

    @staticmethod
    def get_default_dict():
        data = FightObject._init_data()
        dispatched_dict = FightObject._data2dispatched_dict(data)
        return dispatched_dict


if __name__ == "__main__":
    fightobj = FightObject()
    fightobj.set_prompt_info(user="User1", role="Soldier", prompt="乌鸦坐飞机")
    fightobj.set_target_pos(user="User1", role="Soldier", target_pos=[0.5, 0.7])
    dispatched_str = fightobj.get_dispatched_str()
    print(dispatched_str)

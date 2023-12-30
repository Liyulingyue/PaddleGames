import json
import math

class FightObject(object):
    def __init__(self):
        super().__init__()
        self.data = self.init_data()

    def init_data(self):
        data = {}
        for user in ["User1", "User2"]:
            data[user] = {}
            for role in ["Soldier", "Rider", "Archer"]:
                data[user][role] = {}
                data[user][role]["hp"] = 100
                data[user][role]["x"] = 0.1 if user=="User1" else 0.9
                data[user][role]["y"] = 0.3 if role=="Soldier" else 0.5 if role=="Rider" else 0.7
                data[user][role]["target_x"] = data[user][role]["x"]
                data[user][role]["target_y"] = data[user][role]["y"]
                data[user][role]["prompt"] = "" # 空意味着无阵法
                data[user][role]["ATK"] = 2
                data[user][role]["DEF"] = 1
                data[user][role]["element"] = "" # 无阵法时无属性
        return data

    def update(self):
        # 所有士兵向目的地移动（增加移动速度的配置信息）
        for user in self.data:
            for role in self.data[user]:
                x = self.data[user][role]["x"]
                y = self.data[user][role]["y"]
                target_x = self.data[user][role]["target_x"]
                target_y = self.data[user][role]["target_y"]
                hp = self.data[user][role]["hp"]
                if (hp<=0) or (x==target_x and y==target_y):
                    continue # pass role with no hp or already in target position
                else:
                    speed = self._get_speed_of_role(role)
                    new_x, new_y = self._move_2d(x,y,target_x,target_y,speed)
                    self.data[user][role]["x"] = new_x
                    self.data[user][role]["y"] = new_y

        # 所有士兵检索最近一个地方单位，进行攻击，扣除相应单位血量，需要按照属性计算克制关系
        self._update_hp("User1", "User2")
        self._update_hp("User2", "User1")

    def _update_hp(self, base_user, another_user):
        for role in self.data[base_user]:
            nearest_role = ""
            nearest_distance = 2 # the max distance is sqrt(2)
            x = self.data[base_user][role]["x"]
            y = self.data[base_user][role]["y"]
            target_x = self.data[base_user][role]["target_x"]
            target_y = self.data[base_user][role]["target_y"]
            hp = self.data[base_user][role]["hp"]
            ranger = self._get_ranger_of_role(role)
            if (hp <= 0) or (x != target_x or y != target_y):
                continue  # pass role with no hp or in moving
            for role_ in self.data[another_user]:
                x_ = self.data[another_user][role_]["x"]
                y_ = self.data[another_user][role_]["y"]
                target_x_ = self.data[another_user][role_]["target_x"]
                target_y_ = self.data[another_user][role_]["target_y"]
                hp_ = self.data[another_user][role_]["hp"]
                if (hp_ <= 0) or (x_ != target_x_ and y_ != target_y_):
                    continue  # pass role with no hp or in moving
                distance = math.sqrt((x - x_) ** 2 + (y - y_) ** 2)
                if ranger < distance:
                    continue
                else:
                    if distance<nearest_distance:
                        nearest_distance = distance
                        nearest_role = role_
            if nearest_role in ["Soldier", "Rider", "Archer"]:
                ATK = self.data[base_user][role]["ATK"]
                DEF_ = self.data[another_user][nearest_role]["DEF"]
                element = self.data[base_user][role]["element"]
                element_ = self.data[another_user][role]["element"]
                damage = max(0, ATK-DEF_)
                hp_ = self.data[another_user][nearest_role]["hp"]
                hp_ = hp_ - damage
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
        data = {}
        for user in ["User1", "User2"]:
            data[user] = {}
            for role in ["Soldier", "Rider", "Archer"]:
                data[user][role] = [self.data[user][role]["hp"],
                                    self.data[user][role]["x"],
                                    self.data[user][role]["y"],
                                    self.data[user][role]["target_x"],
                                    self.data[user][role]["target_y"],
                                    self.data[user][role]["prompt"]]
        dispatched_str = json.dumps(data)
        return dispatched_str

    def _get_speed_of_role(self, role):
        if role == "Soldier":
            speed = 0.01
        elif role == "Archer":
            speed = 0.01
        elif role == "Rider":
            speed = 0.015
        else:
            speed = 0.01
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

    def _move_2d(self, x, y, target_x, target_y, speed):
        # 计算当前位置到目标位置的距离
        distance = math.sqrt((target_x - x) ** 2 + (target_y - y) ** 2)

        # 如果距离小于或等于速度，则直接到达目标位置
        if distance <= speed:
            new_x, new_y = target_x, target_y
        else:
            # 计算移动的方向向量
            dx = target_x - x
            dy = target_y - y
            # 归一化方向向量
            direction = [dx / distance, dy / distance]
            # 根据速度计算新的位置
            new_x = x + direction[0] * speed
            new_y = y + direction[1] * speed
        return new_x, new_y


if __name__ == "__main__":
    fightobj = FightObject()
    fightobj.set_prompt_info(user="User1", role="Soldier", prompt="乌鸦坐飞机")
    fightobj.set_target_pos(user="User1", role="Soldier", target_pos=[0.5, 0.7])
    dispatched_str = fightobj.get_dispatched_str()
    print(dispatched_str)
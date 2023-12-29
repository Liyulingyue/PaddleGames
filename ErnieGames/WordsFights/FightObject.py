import json

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
        # TODO: 所有士兵向目的地移动（增加移动速度的配置信息）
        # TODO: 所有士兵检索最近一个地方单位，进行攻击，扣除相应单位血量，需要按照属性计算克制关系
        pass

    def set_prompt_info(self, user, role, **kwargs):
        for key in ["prompt", "ATK", "DEF", "element"]:
            self.data[user][role][key] = kwargs[key] if key in kwargs else self.data[user][role][key]

    def set_target_pos(self, user, role, target_pos):
        # TODO: 需要增加检测，避免两个士兵移动到相同的位置，从而重叠
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
                                    self.data[user][role]["target_y"]]
        dispatched_str = json.dumps(data)
        return dispatched_str


if __name__ == "__main__":
    fightobj = FightObject()
    fightobj.set_prompt_info(user="User1", role="Soldier", prompt="乌鸦坐飞机")
    fightobj.set_target_pos(user="User1", role="Soldier", target_pos=[0.5, 0.7])
    dispatched_str = fightobj.get_dispatched_str()
    print(dispatched_str)
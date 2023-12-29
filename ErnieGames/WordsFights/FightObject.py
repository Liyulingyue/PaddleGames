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

if __name__ == "__main__":
    fightobj = FightObject()
    print(fightobj.data)
def get_init_gameobj():
    game_obj = {
        "User1":{
            "Soldier": [100, 0.1, 0.3, 0.1, 0.3], # hp, x, y
            "Rider": [100, 0.1, 0.5, 0.1, 0.5],
            "Archer": [100, 0.1, 0.7, 0.1, 0.7],
        },
        "User2": {
            "Soldier": [100, 0.9, 0.3, 0.9, 0.3],  # hp, x, y
            "Rider": [100, 0.9, 0.5, 0.9, 0.5],
            "Archer": [100, 0.9, 0.7, 0.9, 0.7],
        },
    }
    return game_obj
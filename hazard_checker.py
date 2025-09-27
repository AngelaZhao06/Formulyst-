import json
def check_ingrediant(text):
    ingrediantList= text.split(", ")
    with open("hazardous_ingradien.JSON", "r") as jason:
        data=jason.load()
        for ingradiant in data["ingrediant"]:
            for x in range(ingrediantList.length):
                if ingradiant== ingrediantList[x].lower():
                    return jason["impact"]
                
check_ingrediant("Salt, parabanes")
               

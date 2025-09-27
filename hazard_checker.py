import json
def check_ingrediant(text):
    result=""
    ingrediantList= text.split(", ")
    with open("hazardous_ingradient.JSON", "r") as file:
        data=json.load(file)
        for item in ingrediantList:
            for ingradiant in data:
                if ingradiant["ingredient"].lower() == item.lower():
                    result= result + "\n"+ ingradiant["ingredient"] + ": " + ingradiant["impact"]

        return result
                
print(check_ingrediant("Salt, parabens, Sodium Lauryl Sulfate"))
               

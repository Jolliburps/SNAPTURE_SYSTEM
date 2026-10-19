"""Manually checked CESD reference extracts, not image-training data or endorsement.

The original interview and posters remain in the user's CESD folder. File hashes
pin the inspected edition without publishing personal interview material/photos.
"""
SOURCE_HASHES = {
    "bacoor_city_ordinance_solid_waste_management.pptx": "ecb192807a9c2c69abd07de7476774a4c4536dcf87075b668a2c05db29e587a4",
    "InterviewTranscript_CESD.pdf": "48d02e72342dae1b7406a1b702e756382b1b27711cbce4b8f02449188120c9d9",
    "brochures/desludge_front_flyer.png": "ae4952d4c68e2b40b264830705ee374ac08f469a385e0827b4558898c9be798c",
    "brochures/desludge_inside_flyer.png": "75245e4ce530a9b43290a405924934e93c6fc8ff7a830848edeb148a30a5abf4",
    "brochures/haz_waste_front1.png": "efc14a75003c88e29fa877a0c40661244d4674c7a33beba78158d3432370c83d",
    "brochures/haz_waste_inside1b.png": "6816e23f09399fd00fdc8f5ab97683d9662b47705213b30b14b275a8fcc98c52",
    "brochures/new_compost_flyer_front_final1.png": "f1c809fcac7b160a076d89b0ec255a376ea127605f917120a3973d940390ab95",
    "brochures/new_compost_flyer_inside_final1.png": "8ed3695c95c59d375a09b507494180f79d932c8f81de9a76a99434751fd43e39",
    "cesd_activities/cesd_activity_1.png": "f2ecf08d9c5f61564815128675ebcf8788221de5403b6cc1d993773dbef783b0",
    "cesd_activities/cesd_activity_2b.png": "94ac00ee7fdf4b5cfa916dd6c2da1e64722e4a3c336bb55f543638070f96524b",
    "cesd_activities/cesd_activity_3.png": "f2780f6513567f48b1bd8d5fa8a7f24c1b7c580cb2d16bf316bf66b209fbef0f",
}
NOTE = "Source-checked educational adaptation of user-supplied CESD documents. Not CESD approval of SNAPTURE or an expert safety validation. Undated material is not a current service announcement."


def source(name, location):
    return f"CESD supplied reference: {name}, {location}; edition SHA-256 {SOURCE_HASHES[name]}."


def information():
    yield dict(key="cesd-household-hazardous", title="Household hazardous waste precautions", category="Safety",
               summary="Chemical contents require separate handling even when the container looks reusable.",
               instructions=[
                   "Follow the product label. Keep hazardous products in their original labeled containers; do not transfer them to food containers.",
                   "Do not mix chemicals or put hazardous waste with ordinary household waste. Do not pour chemicals into drains or burn them.",
                   "Keep products away from children, pets, heat and direct sunlight. Avoid handling an unknown or leaking container; ask local officials for instructions.",
                   "Coordinate with your barangay or CESD about authorized collection and temporary storage before taking an item to any facility.",
               ], source=source("brochures/haz_waste_front1.png", "Simple precautions for household hazardous waste") + "\nCross-check: https://www.epa.gov/hw/household-hazardous-waste-hhw",
               warnings="A photo cannot establish chemical safety. Do not repurpose chemical containers as food containers or toys. No collection date or receiving facility is confirmed here.")
    yield dict(key="cesd-source-segregation", title="Separate waste at home before collection", category="Segregation",
               summary="Keep separated materials apart and check the instructions for your barangay.",
               instructions=[
                   "Separate waste where it is produced. Keep recoverable material apart from food waste and hazardous items.",
                   "Read the actual resin mark on plastics. PET/PETE is code 1 and HDPE is code 2; a mark alone does not guarantee local acceptance.",
                   "Keep material for recovery clean and dry when safe to do so. Ask the receiving collector what it accepts before handing it over.",
                   "Do not leave waste in streets, waterways or vacant lots. Bring it out according to your barangay's confirmed collection instructions.",
               ], source=source("bacoor_city_ordinance_solid_waste_management.pptx", "slides 3-5 and 8-9, policy-support summaries") + "\nContext: https://bacoor.gov.ph/downloads/arta/CitizensCharter2021.pdf",
               warnings="This presentation is a policy summary, not the full ordinance. Conflicting ordinance labels and penalties require CESD confirmation. No new legal penalties are reproduced.")
    yield dict(key="cesd-can-it-be-sold", title="Can this material be sold or recovered?", category="Recovery",
               summary="Acceptance depends on the item, its condition and the receiving buyer.",
               instructions=[
                   "For clean PET/PETE bottles, HDPE containers, plain paper or cardboard, ask a receiving junkshop or barangay recovery program whether it accepts that exact item.",
                   "Check cleanliness requirements, quantity, collection arrangements and any offered price directly with the receiver.",
                   "Do not assume that every plastic, colored paper or fabric is accepted. Keep an uncertain item separate until you receive instructions.",
                   "Do not break glass, melt plastic or remove hazardous contents to make an item saleable.",
               ], source="User-supplied CESD interview, sections 7, 11 and 14; interpreted as a request for a recovery-information feature, not a validated acceptance list.",
               warnings="No buyer, price, income, acceptance or pickup is guaranteed. SNAPTURE does not provide a marketplace.")
    yield dict(key="cesd-compost-learning", title="Composting basics from the CESD guide", category="Composting",
               summary="An educational topic, not a new food-waste camera category or an automatic project recommendation.",
               instructions=[
                   "The CESD guide combines dry plant material with suitable fruit and vegetable scraps, moisture and air.",
                   "Use only known suitable inputs. Plain uncoated paper, cardboard or untreated wood need additional checks for coatings, chemicals and attachments.",
                   "For a conservative home setup, leave out meat, fish, dairy, oils, pet waste, treated wood and glossy paper. Do not use unknown vacuum dust or chemically contaminated materials.",
                   "Ask CESD for a suitable method for your available space. The app does not promise a composting time or certify finished compost.",
               ], source=source("brochures/new_compost_flyer_inside_final1.png", "compost sandwich and materials panels") + "\nConservative home-use cross-check: https://www.epa.gov/recycle/composting-home",
               warnings="The brochure includes some broader inputs. These are not automatically approved for home composting here. Bottle cutting and a full composting project are withheld pending method and safety validation.")
    yield dict(key="cesd-sanitation-awareness", title="Septic tank safety and authorized services", category="Sanitation",
               summary="Background information from the CESD sanitation brochure, outside image identification.",
               instructions=[
                   "Use an authorized service provider for septic tank inspection and desludging; do not open or enter a tank yourself.",
                   "Do not put plastics, wipes, grease or chemicals into toilets or drains.",
                   "Report wastewater overflow or suspected leaks to the appropriate local service office. Ask CESD about current authorized providers and arrangements.",
               ], source=source("brochures/desludge_inside_flyer.png", "Important reminders and household responsibilities"),
               warnings="This is not a service booking, diagnosis or guaranteed desludging schedule. Septic tanks can contain dangerous gases.")
    yield dict(key="cesd-program-background", title="CESD programs and collection information", category="Local information",
               summary="The supplied posters document environmental activities; they do not announce upcoming events.",
               instructions=[
                   "The posters show coastal and river cleanups, garbage collection, composting, information campaigns, enforcement, greening and tree planting.",
                   "For bulky items, garden waste or hazardous waste, ask your barangay or CESD about separate collection arrangements before setting items out.",
                   "The app calendar shows published dates for your selected barangay only. An empty date means no verified notice is available, not that no collection occurs.",
                   "Confirm current contact details and service availability through the official Bacoor website or your barangay: https://bacoor.gov.ph/",
               ], source="CESD regular-activities posters cesd_activity_1.png, cesd_activity_2b.png and cesd_activity_3.png; user-supplied interview sections 3 and 15.",
               warnings="No recurring dates, 2027 plans, truck arrival times or present-day service availability are inferred from these sources.")

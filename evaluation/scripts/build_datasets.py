#!/usr/bin/env python3
"""Build Veridex evaluation datasets from curated real-world statements."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASETS = ROOT / "datasets"


def write(name: str, rows: list[dict]) -> None:
    DATASETS.mkdir(parents=True, exist_ok=True)
    with (DATASETS / name).open("w") as handle:
        json.dump(rows, handle, indent=2)
        handle.write("\n")


def claim(sentence: str, claim_type: str = "identity", compound: bool = False) -> dict:
    return {"claimText": sentence, "claimType": claim_type, "isCompound": compound}


extraction_rows = [
    ("Apple's revenue reached $383 billion in fiscal year 2023.", True, [claim("Apple's revenue reached $383 billion in fiscal year 2023.", "statistic")]),
    ("The speed of light in vacuum is exactly 299,792,458 meters per second.", True, [claim("The speed of light in vacuum is exactly 299,792,458 meters per second.", "scientific")]),
    ("Paris is the capital of France.", True, [claim("Paris is the capital of France.")]),
    ("The United Nations was founded in 1945.", True, [claim("The United Nations was founded in 1945.", "historical")]),
    ("Mount Everest rises about 8,849 meters above sea level.", True, [claim("Mount Everest rises about 8,849 meters above sea level.", "statistic")]),
    ("The WHO declared COVID-19 a pandemic on March 11, 2020.", True, [claim("The WHO declared COVID-19 a pandemic on March 11, 2020.", "historical")]),
    ("Water freezes at 0 degrees Celsius at standard atmospheric pressure.", True, [claim("Water freezes at 0 degrees Celsius at standard atmospheric pressure.", "scientific")]),
    ("The euro is used by many members of the European Union.", True, [claim("The euro is used by many members of the European Union.", "identity")]),
    ("The Amazon River flows through Brazil.", True, [claim("The Amazon River flows through Brazil.", "geographic")]),
    ("The first iPhone was introduced by Apple in 2007.", True, [claim("The first iPhone was introduced by Apple in 2007.", "historical")]),
    ("The Pacific Ocean is the largest ocean on Earth.", True, [claim("The Pacific Ocean is the largest ocean on Earth.", "geographic")]),
    ("The chemical symbol for gold is Au.", True, [claim("The chemical symbol for gold is Au.", "scientific")]),
    ("The Federal Reserve is the central bank of the United States.", True, [claim("The Federal Reserve is the central bank of the United States.", "identity")]),
    ("The Suez Canal connects the Mediterranean Sea and the Red Sea.", True, [claim("The Suez Canal connects the Mediterranean Sea and the Red Sea.", "geographic")]),
    ("Japan hosted the Summer Olympics in 1964 and 2021.", True, [claim("Japan hosted the Summer Olympics in 1964 and 2021.", "historical")]),
    ("The human genome contains about 3 billion base pairs.", True, [claim("The human genome contains about 3 billion base pairs.", "scientific")]),
    ("The World Bank classifies economies by gross national income per capita.", True, [claim("The World Bank classifies economies by gross national income per capita.", "economic")]),
    ("The Berlin Wall fell in November 1989.", True, [claim("The Berlin Wall fell in November 1989.", "historical")]),
    ("Carbon dioxide is a greenhouse gas.", True, [claim("Carbon dioxide is a greenhouse gas.", "scientific")]),
    ("Microsoft was founded by Bill Gates and Paul Allen.", True, [claim("Microsoft was founded by Bill Gates and Paul Allen.", "identity")]),
    ("India's GDP grew 8.2% and inflation fell to 4.7% in the second quarter.", True, [claim("India's GDP grew 8.2% in the second quarter.", "statistic", True), claim("India's inflation fell to 4.7% in the second quarter.", "statistic", True)]),
    ("Germany's capital is Berlin and its currency is the euro.", True, [claim("Germany's capital is Berlin.", "identity", True), claim("Germany's currency is the euro.", "identity", True)]),
    ("Marie Curie won Nobel Prizes in Physics and Chemistry.", True, [claim("Marie Curie won a Nobel Prize in Physics.", "historical", True), claim("Marie Curie won a Nobel Prize in Chemistry.", "historical", True)]),
    ("The Nile is often cited as the world's longest river, while the Amazon carries the largest volume of water.", True, [claim("The Nile is often cited as the world's longest river.", "geographic", True), claim("The Amazon carries the largest volume of water.", "geographic", True)]),
    ("Tesla delivered more than 1.8 million vehicles in 2023 and opened its first Gigafactory in Nevada.", True, [claim("Tesla delivered more than 1.8 million vehicles in 2023.", "statistic", True), claim("Tesla opened its first Gigafactory in Nevada.", "historical", True)]),
    ("COVID-19 vaccines reduce severe disease, and mRNA vaccines teach cells to make a harmless spike protein fragment.", True, [claim("COVID-19 vaccines reduce severe disease.", "scientific", True), claim("mRNA vaccines teach cells to make a harmless spike protein fragment.", "scientific", True)]),
    ("The Treaty of Versailles was signed in 1919, and the League of Nations was created after World War I.", True, [claim("The Treaty of Versailles was signed in 1919.", "historical", True), claim("The League of Nations was created after World War I.", "historical", True)]),
    ("OpenAI released ChatGPT in 2022 and GPT-4 in 2023.", True, [claim("OpenAI released ChatGPT in 2022.", "technology", True), claim("OpenAI released GPT-4 in 2023.", "technology", True)]),
    ("The moon orbits Earth and reflects sunlight.", True, [claim("The moon orbits Earth.", "scientific", True), claim("The moon reflects sunlight.", "scientific", True)]),
    ("Brazil is in South America and Portuguese is its official language.", True, [claim("Brazil is in South America.", "geographic", True), claim("Portuguese is Brazil's official language.", "identity", True)]),
    ("This is clearly the worst policy decision in recent memory.", False, []),
    ("Everyone knows this plan is ridiculous.", False, []),
    ("Why would any reasonable person support that proposal?", False, []),
    ("The movie felt too long and emotionally empty.", False, []),
    ("In my view, the new interface is beautiful.", False, []),
    ("That speech was inspiring but deeply frustrating.", False, []),
    ("Maybe this is the beginning of a better era.", False, []),
    ("The best solution is obvious to anyone paying attention.", False, []),
    ("What a disastrous and embarrassing performance.", False, []),
    ("The policy should be rejected immediately.", False, []),
    ("The iPhone launched in 2007, but it remains the most magical device ever made.", True, [claim("The iPhone launched in 2007.", "historical")]),
    ("Paris is the capital of France, and it is the most romantic city in the world.", True, [claim("Paris is the capital of France.", "identity")]),
    ("The Federal Reserve raised rates in 2022, which was obviously reckless.", True, [claim("The Federal Reserve raised rates in 2022.", "economic")]),
    ("NASA landed Apollo 11 on the Moon in 1969, a moment no one could ever surpass.", True, [claim("NASA landed Apollo 11 on the Moon in 1969.", "historical")]),
    ("The WHO was founded in 1948, though its recent choices are controversial.", True, [claim("The WHO was founded in 1948.", "historical")]),
    ("Tokyo hosted the Olympics in 2021, and the ceremony was stunning.", True, [claim("Tokyo hosted the Olympics in 2021.", "historical")]),
    ("Carbon dioxide traps heat, which makes ignoring climate change foolish.", True, [claim("Carbon dioxide traps heat.", "scientific")]),
    ("Microsoft owns LinkedIn, but the acquisition was too expensive.", True, [claim("Microsoft owns LinkedIn.", "identity")]),
    ("The euro launched in electronic form in 1999, and it was a bold experiment.", True, [claim("The euro launched in electronic form in 1999.", "historical")]),
    ("The Nile flows through Egypt, making it an unforgettable river.", True, [claim("The Nile flows through Egypt.", "geographic")]),
]

write(
    "claim_extraction_test.json",
    [
        {"id": f"ext-{index:03d}", "sentence": sentence, "groundTruth": {"isFactual": factual, "claims": claims}}
        for index, (sentence, factual, claims) in enumerate(extraction_rows, 1)
    ],
)

retrieval_rows = [
    ("The capital of Germany is Berlin.", "identity", ["wiki-germany-001", "wiki-berlin-001"], ["Germany", "Berlin", "capital"], "hybrid_reranked"),
    ("The capital of Japan is Tokyo.", "identity", ["wiki-japan-001", "wiki-tokyo-001"], ["Japan", "Tokyo", "capital"], "hybrid_reranked"),
    ("The Nile flows through Egypt.", "geographic", ["wiki-nile-001", "wiki-egypt-001"], ["Nile", "Egypt", "river"], "hybrid_reranked"),
    ("Mount Everest is located in the Himalayas.", "geographic", ["wiki-everest-001", "wiki-himalayas-001"], ["Everest", "Himalayas"], "hybrid_reranked"),
    ("Canberra is the capital of Australia.", "identity", ["wiki-australia-001", "wiki-canberra-001"], ["Australia", "Canberra", "capital"], "hybrid_reranked"),
    ("The Amazon River passes through Brazil.", "geographic", ["wiki-amazon-river-001", "wiki-brazil-001"], ["Amazon", "Brazil"], "hybrid_reranked"),
    ("Apple reported $383 billion in revenue for fiscal year 2023.", "statistic", ["company-apple-2023-001", "apple-10k-2023-001"], ["Apple", "383 billion", "2023"], "hybrid_reranked"),
    ("Tesla delivered more than 1.8 million vehicles in 2023.", "statistic", ["company-tesla-2023-001", "tesla-deliveries-2023-001"], ["Tesla", "1.8 million", "deliveries"], "hybrid_reranked"),
    ("India's real GDP growth was 8.2 percent in fiscal year 2023-24.", "statistic", ["worldbank-india-gdp-001", "mospi-india-2024-001"], ["India", "GDP", "8.2"], "hybrid_reranked"),
    ("The United States population exceeded 330 million in the 2020 census.", "statistic", ["us-census-2020-001", "wiki-united-states-001"], ["United States", "population", "330 million"], "hybrid_reranked"),
    ("Global atmospheric CO2 exceeded 420 ppm in 2023.", "statistic", ["noaa-co2-2023-001", "climate-co2-001"], ["CO2", "420 ppm", "2023"], "hybrid_reranked"),
    ("The WHO declared COVID-19 a pandemic on March 11, 2020.", "historical", ["who-covid-pandemic-001", "wiki-covid-pandemic-001"], ["WHO", "COVID-19", "pandemic"], "hybrid_reranked"),
    ("Japan hosted the Summer Olympics in 1964.", "historical", ["wiki-1964-olympics-001", "wiki-japan-001"], ["Japan", "1964", "Olympics"], "hybrid_reranked"),
    ("The Treaty of Versailles was signed in 1919.", "historical", ["wiki-versailles-001", "history-wwi-001"], ["Treaty of Versailles", "1919"], "hybrid_reranked"),
    ("The Berlin Wall fell in 1989.", "historical", ["wiki-berlin-wall-001", "history-cold-war-001"], ["Berlin Wall", "1989"], "hybrid_reranked"),
    ("The United Nations was founded in 1945.", "historical", ["wiki-un-001", "un-history-001"], ["United Nations", "1945"], "hybrid_reranked"),
    ("Apollo 11 landed humans on the Moon in 1969.", "historical", ["nasa-apollo11-001", "wiki-apollo11-001"], ["Apollo 11", "Moon", "1969"], "hybrid_reranked"),
    ("The speed of light is 299,792,458 meters per second.", "scientific", ["nist-speed-light-001", "wiki-speed-light-001"], ["speed of light", "299792458"], "hybrid_reranked"),
    ("Water boils at 100 degrees Celsius at standard pressure.", "scientific", ["nist-water-boiling-001", "wiki-water-001"], ["water", "100 Celsius", "pressure"], "hybrid_reranked"),
    ("Carbon dioxide is a greenhouse gas.", "scientific", ["epa-greenhouse-gases-001", "wiki-carbon-dioxide-001"], ["carbon dioxide", "greenhouse gas"], "hybrid_reranked"),
    ("The human genome contains about 3 billion base pairs.", "scientific", ["nih-human-genome-001", "wiki-human-genome-001"], ["human genome", "3 billion"], "hybrid_reranked"),
    ("mRNA vaccines use messenger RNA to instruct cells to make a protein.", "scientific", ["cdc-mrna-vaccine-001", "who-vaccines-001"], ["mRNA", "vaccines", "protein"], "hybrid_reranked"),
    ("Gold has the chemical symbol Au.", "scientific", ["nist-gold-001", "wiki-gold-001"], ["gold", "Au"], "hybrid_reranked"),
    ("Microsoft owns LinkedIn.", "company_identity", ["company-microsoft-linkedin-001", "wiki-linkedin-001"], ["Microsoft", "LinkedIn"], "hybrid_reranked"),
    ("Alphabet is Google's parent company.", "company_identity", ["company-alphabet-001", "wiki-google-001"], ["Alphabet", "Google"], "hybrid_reranked"),
    ("Nvidia is headquartered in Santa Clara, California.", "company_identity", ["company-nvidia-001", "wiki-nvidia-001"], ["Nvidia", "Santa Clara"], "hybrid_reranked"),
    ("OpenAI released ChatGPT in 2022.", "company_identity", ["company-openai-chatgpt-001", "wiki-chatgpt-001"], ["OpenAI", "ChatGPT", "2022"], "hybrid_reranked"),
    ("The euro was launched as an electronic currency in 1999.", "historical", ["ecb-euro-history-001", "wiki-euro-001"], ["euro", "1999"], "hybrid_reranked"),
    ("The International Monetary Fund was created in 1944.", "historical", ["imf-history-001", "wiki-imf-001"], ["IMF", "1944"], "hybrid_reranked"),
    ("The World Bank publishes GDP data for member countries.", "statistic", ["worldbank-data-001", "worldbank-gdp-001"], ["World Bank", "GDP", "data"], "hybrid_reranked"),
]
write(
    "retrieval_test.json",
    [
        {
            "id": f"ret-{index:03d}",
            "claim": row[0],
            "claimType": row[1],
            "groundTruthChunkIds": row[2],
            "relevantKeywords": row[3],
            "expectedRetrievalStrategy": row[4],
        }
        for index, row in enumerate(retrieval_rows, 1)
    ],
)

verification_rows = [
    ("The speed of light is approximately 300,000 km/s.", "VERIFIED", "scientific", "easy", "Rounded value of a physical constant."),
    ("Paris is the capital of France.", "VERIFIED", "identity", "easy", "Common geographic fact."),
    ("The United Nations was founded in 1945.", "VERIFIED", "historical", "easy", "UN Charter entered into force in 1945."),
    ("Water freezes at 0 degrees Celsius at standard atmospheric pressure.", "VERIFIED", "scientific", "easy", "Standard physical property."),
    ("The Berlin Wall fell in 1989.", "VERIFIED", "historical", "easy", "Established Cold War event."),
    ("Microsoft owns LinkedIn.", "VERIFIED", "company_identity", "easy", "Microsoft completed the LinkedIn acquisition in 2016."),
    ("The WHO was founded in 1948.", "VERIFIED", "historical", "easy", "WHO constitution came into force in 1948."),
    ("Gold has the chemical symbol Au.", "VERIFIED", "scientific", "easy", "Periodic table fact."),
    ("Apollo 11 landed humans on the Moon in 1969.", "VERIFIED", "historical", "easy", "NASA mission history."),
    ("Canberra is the capital of Australia.", "VERIFIED", "identity", "easy", "Capital city fact."),
    ("The Great Wall of China is visible from space with the naked eye.", "FALSE", "known_falsehood", "easy", "Common myth contradicted by NASA and astronaut accounts."),
    ("Humans only use 10% of their brain.", "FALSE", "known_falsehood", "easy", "Neuroscience myth."),
    ("Vaccines cause autism.", "FALSE", "known_falsehood", "easy", "Rejected by large epidemiological studies."),
    ("Antibiotics kill viruses.", "FALSE", "known_falsehood", "easy", "Antibiotics treat bacterial infections."),
    ("Cracking knuckles causes arthritis.", "FALSE", "known_falsehood", "easy", "Common medical myth."),
    ("Lightning never strikes the same place twice.", "FALSE", "known_falsehood", "easy", "Lightning can repeatedly strike tall structures."),
    ("The Earth is flat.", "FALSE", "known_falsehood", "easy", "Contradicted by extensive scientific evidence."),
    ("Sugar causes hyperactivity in children.", "FALSE", "known_falsehood", "medium", "Popular claim not supported by controlled studies."),
    ("Remote work increases productivity for most software teams.", "DISPUTED", "workplace", "medium", "Studies vary by role, measurement, and organizational context."),
    ("Universal basic income reduces poverty without reducing labor participation.", "DISPUTED", "policy", "hard", "Evidence differs across pilots and contexts."),
    ("Nuclear power is the safest scalable energy source.", "DISPUTED", "energy", "hard", "Depends on risk metric and lifecycle framing."),
    ("Social media use is the primary cause of adolescent depression.", "DISPUTED", "health", "hard", "Associations exist but causality and magnitude are debated."),
    ("Raising minimum wages causes job losses.", "DISPUTED", "economic", "hard", "Empirical findings vary by labor market and policy size."),
    ("Charter schools outperform public schools.", "DISPUTED", "education", "medium", "Performance varies across regions and operators."),
    ("Artificial sweeteners help with long-term weight loss.", "DISPUTED", "health", "medium", "Clinical and observational evidence is mixed."),
    ("Carbon capture will be cost-effective enough to meet 2050 climate targets.", "DISPUTED", "climate", "hard", "Future cost and deployment assumptions remain contested."),
    ("A 2017 municipal audit in Latur found that ward-level streetlight repairs averaged 38 hours.", "UNSUPPORTED", "local_government", "hard", "Specific local statistic likely absent from the seeded KB."),
    ("The 1998 annual report of a small Kerala cooperative listed 17,432 active members.", "UNSUPPORTED", "obscure_statistic", "hard", "Highly specific archival claim."),
    ("A 2011 field survey counted 284 mature tamarind trees along a district road in Karnataka.", "UNSUPPORTED", "local_environment", "hard", "Narrow local survey claim."),
    ("A 2004 museum catalog recorded 73 bronze lamps in a private temple collection in Thanjavur.", "UNSUPPORTED", "archive", "hard", "Specific catalog inventory claim."),
    ("A local newspaper reported that three footbridges opened in Shillong in July 1996.", "UNSUPPORTED", "local_history", "hard", "May require local newspaper archives."),
    ("A 2019 procurement notice in Nagpur specified 14 solar-powered bus shelters.", "UNSUPPORTED", "procurement", "hard", "Specific procurement detail."),
    ("A small clinical trial in Pune in 2006 enrolled exactly 42 patients for a herbal cough syrup study.", "UNSUPPORTED", "clinical", "hard", "Very specific study claim."),
    ("An unreleased internal memo from a private bank says its fraud losses doubled last week.", "INSUFFICIENT_EVIDENCE", "private_document", "hard", "Private unreleased source cannot be verified from public evidence."),
    ("A confidential cabinet note states that a new tax will be announced next month.", "INSUFFICIENT_EVIDENCE", "private_document", "hard", "Future confidential policy claim."),
    ("A private meeting between two CEOs finalized a merger that has not been announced.", "INSUFFICIENT_EVIDENCE", "business", "hard", "No public evidence should exist."),
    ("A lab has achieved room-temperature superconductivity but has not released data.", "INSUFFICIENT_EVIDENCE", "scientific", "hard", "Extraordinary unpublished claim."),
    ("A celebrity privately donated $5 million yesterday without any public record.", "INSUFFICIENT_EVIDENCE", "private_event", "hard", "Specific private donation."),
    ("An undisclosed security flaw currently affects every major bank in Europe.", "INSUFFICIENT_EVIDENCE", "cybersecurity", "hard", "Broad but unsupported undisclosed security claim."),
    ("A prototype drug cured all participants in a trial whose results remain unpublished.", "INSUFFICIENT_EVIDENCE", "health", "hard", "Unpublished trial outcome."),
]
write(
    "verification_test.json",
    [
        {"id": f"ver-{index:03d}", "claim": row[0], "groundTruthVerdict": row[1], "claimType": row[2], "difficulty": row[3], "notes": row[4]}
        for index, row in enumerate(verification_rows, 1)
    ],
)

manipulation_rows = [
    ("This disastrous policy has already destroyed household budgets. The official inflation report shows prices rose again, and families are being crushed.", True, ["emotional_language"], "Moderate"),
    ("The corrupt minister announced a new contract while unemployment remained high. Citizens deserve the truth.", True, ["emotional_language", "ad_hominem"], "Moderate"),
    ("The company posted a quarterly loss, proving its reckless leaders are ruining the business.", True, ["emotional_language"], "Moderate"),
    ("Crime rose 4 percent last year, and the city is becoming a nightmare for ordinary residents.", True, ["emotional_language"], "Moderate"),
    ("The hospital closed two wards, leaving vulnerable patients abandoned by a failed system.", True, ["emotional_language"], "Moderate"),
    ("BREAKING: The biggest tax hike in history is coming for every family!! The proposal raises several fees next year.", True, ["sensational_framing"], "High"),
    ("BOMBSHELL documents show the agency missed its deadline. Officials released the timeline on Monday.", True, ["sensational_framing"], "Moderate"),
    ("SHOCKING numbers reveal the worst downturn since 2020. Retail sales fell for two months.", True, ["sensational_framing"], "Moderate"),
    ("The report proves a TOTAL collapse is underway!! Output declined in one sector.", True, ["sensational_framing"], "High"),
    ("It is clear that the vaccine is dangerous despite limited evidence from the cited study.", True, ["certainty_inflation"], "High"),
    ("Obviously the mayor lied about the budget because revenue estimates changed in April.", True, ["certainty_inflation"], "Moderate"),
    ("Without doubt, the new trade deal will destroy local farms, although the tariff data is preliminary.", True, ["certainty_inflation"], "High"),
    ("The data undeniably proves remote work failed, but the survey covered only one firm.", True, ["certainty_inflation"], "Moderate"),
    ("You are either with the reformers or against the country. If we do not pass this bill, chaos will follow.", True, ["false_dilemma"], "High"),
    ("Either the platform bans anonymous accounts or democracy will collapse. There is no middle ground.", True, ["false_dilemma"], "High"),
    ("If we do not approve the project now, the entire region will be ruined.", True, ["false_dilemma"], "Moderate"),
    ("Act now before it's too late. Share this warning immediately because contaminated water could kill children.", True, ["fear_appeal"], "High"),
    ("Buy protection now before disaster strikes. Officials reported a rise in burglaries.", True, ["fear_appeal"], "Moderate"),
    ("The city says traffic deaths fell after the camera program began. The text omits that road redesigns were introduced at the same time.", True, ["missing_context"], "Moderate"),
    ("A school reports higher test scores after adopting tablets. The passage omits that the student population changed substantially.", True, ["missing_context"], "Moderate"),
]
write(
    "manipulation_test.json",
    [
        {"id": f"man-{index:03d}", "text": text, "groundTruth": {"hasManipulation": has, "tactics": tactics, "manipulationLabel": label}}
        for index, (text, has, tactics, label) in enumerate(manipulation_rows, 1)
    ],
)

print("Wrote evaluation datasets")

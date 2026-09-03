### 1. Generating Fake or Real VINs

* **Fake / Sample VIN Generator:** Use standard online VIN generators (such as `vingenerator.org` or `faxvin.com/vin-decoder/generator`) to quickly generate valid 17-character VIN strings that satisfy standard ISO 3779 checksum checks (`check digit` calculation at character position 9).
* **Real VINs:** You can easily grab real, active VINs directly from public online dealer inventory listings (e.g., searching for any vehicle on AutoTrader, CarGurus, or local dealership websites, where VINs are listed publicly on the Vehicle Details Page).

---

### 2. Auto-Populating Vehicle Details from a VIN

Yes, if you enter a valid 17-character VIN, the application uses the **NHTSA vPIC API** (a free, public US government API) to automatically decode the VIN into its core attributes:

* **API Endpoint:** `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{VIN}?format=json`
* **Decoded Fields:** The response instantly yields **Year**, **Make**, **Model**, **Trim**, **Body Class**, **Engine Specs**, and **Drive Type** without requiring a paid data feed.
* **Fallback Behavior:** If the NHTSA lookup fails (or if an invalid/unrecognized VIN string is entered), the UI falls back to manual select boxes so you can still manually specify the Year, Make, Model, and Trim.

---

### 3. Obtaining Sample Offer Sheets (CarMax, Carvana, AutoNation, KBB)

To test your document parsing engine (OCR, PDF text extraction, and competitor offer extraction), you can gather or simulate offer documents through a few methods:

#### A. Synthetic Test Documents (Quickest & Most Reliable for Automated Testing)
Create simple mock PDF or image files that mimic the standard layouts of real competitor offer sheets. Include distinct structural fields to test your regex/OCR parser against:
* **CarMax Written Offer:** Features a prominent **"CarMax Store #"**, **"7-Day Offer Amount"**, **17-digit VIN**, and **Mileage**.
* **Carvana Appraisal Offer:** Features **"Carvana Cash Offer"**, **"Expiration Date"**, **VIN**, and **Vehicle Description**.
* **KBB Instant Cash Offer (ICO):** Features a **"Participating Dealer Offer"**, **"Offer Code"**, and **"Valid Through"** date.

#### B. Obtaining Real Sample Offers
* **Personal or Network Request:** If you or a friend have recently run a vehicle appraisal online through Carvana or KBB, you can export or screenshot the resulting PDF/email appraisal sheet.
* **Carvana Online Flow:** You can run any real public VIN through Carvana’s online appraisal wizard in under 2 minutes (using sample contact details and mileage) to generate a genuine downloadable offer document.

---

### Testing Strategy

When running test documents through your intake flow, check for these three specific parsing triggers:

1. **Competitor Identification:** Does the parser correctly identify whether the sheet came from CarMax, Carvana, or a regional competitor?
2. **Offer Amount Extraction:** Does it cleanly parse the dollar amount without being tricked by trade-in tax savings or payoff estimates?
3. **Instant Counter Threshold:** Does the parsed offer correctly trigger an automatic counter-offer calculation, or route to the **Lead Inbox** when the margin threshold requires manager approval?


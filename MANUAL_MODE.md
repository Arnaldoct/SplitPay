# Manual Mode Guide

## Overview

**Manual Mode** is SplitPay's default operating mode when a restaurant doesn't have a POS integration. The restaurant manager uses the dashboard to manually enter checks as guests order.

**Perfect for:**
- Pilot restaurants
- Small venues without POS systems
- Testing and validation
- Quick onboarding (no API setup needed)

---

## Onboarding a New Restaurant

### Step 1: Run Onboarding Script

```bash
npm run onboard
```

The script will ask for:
- Restaurant name
- URL slug (e.g., "purple-plate")
- Contact email & phone
- Manager name & email (for login)
- Address (optional)

**Output:**
- Creates venue in database
- Creates manager user account
- Sets up manual mode integration
- Provides login instructions

### Step 2: Send Login Link

Email the manager:
```
Subject: Welcome to SplitPay!

Hi [Manager Name],

Your restaurant is now set up with SplitPay!

Login here: https://app.splitpayusa.com/dashboard/login
Use your email: [manager@email.com]

You'll receive a magic link to login (no password needed).

First steps:
1. Create your tables
2. Generate QR codes
3. Start accepting payments!

Need help? Reply to this email.

- The SplitPay Team
```

---

## Manager First-Time Setup (5 minutes)

### 1. Login
- Go to dashboard login page
- Enter email
- Check email for magic link
- Click link → Logged in!

### 2. Create Tables
- Dashboard → "Tables & QR Codes"
- Click "+ Add Table"
- Enter table number (e.g., "1", "2", "Bar")
- Repeat for all tables

### 3. Generate QR Codes
- For each table, click "Generate QR Code"
- Download QR code image
- Print QR codes (or save to print later)
- Place QR code on each table

**QR Code Options:**
- Print on cardstock and laminate
- Use acrylic holders
- Frame and mount on table
- Include in menu

### 4. Test a Payment
- Click "Create Check"
- Select a table
- Add test items:
  - Water: $0 (free)
  - Test Item: $0.50
- Save check
- Scan QR code with phone
- Pay with test card: 4242 4242 4242 4242
- Verify transaction appears in "Transactions"

✅ **Setup complete!**

---

## Daily Operations: Manual Check Entry

### When a Guest Orders

1. **Guest orders** at table
2. **Server takes order** (pen & paper, or POS)
3. **Manager enters check** in SplitPay dashboard:

#### Steps:
1. Dashboard → "Create Check"
2. Select table number
3. Add items:
   - Name: "Cheeseburger"
   - Quantity: 1
   - Price: $16.00
4. Click "+ Add Item" for each item
5. Set tax rate (default: 9%)
6. Review totals
7. Click "Create Check"

✅ **Check is now live!**

### When Guest Wants to Pay

1. **Guest scans QR code** on table
2. **Sees their check** with all items
3. **Chooses split method:**
   - Pay full
   - Split evenly (2-20 people)
   - Split by item
   - Custom amount
4. **Adds tip** (15%, 18%, 20%, 22%, custom, or no tip)
5. **(Optional) Enters email** for receipt
6. **Pays** via Stripe (Apple Pay, Google Pay, or card)
7. **Success!** Gets confirmation

### After Payment

- Manager sees transaction in "Transactions"
- Check status updates to "paid" (or "partially paid")
- Guest receives email receipt (if provided email)
- Manager can issue refunds if needed

---

## Tips for Smooth Operations

### Best Practices

1. **Enter checks promptly** - Right when guest orders
2. **Double-check prices** - Match your menu
3. **Update items** - If guest adds/removes items, you can void and recreate check
4. **Watch for split payments** - Multiple guests can pay from same table
5. **Close out at end of night** - Review all transactions

### Time Comparison

**Traditional:**
- Server takes order → Kitchen
- Guest requests check → Server prints
- Guest pays → Server processes card → Returns
- **Total: ~10-15 minutes**

**With SplitPay Manual Mode:**
- Server takes order → Manager enters in dashboard (30 seconds)
- Guest scans → Pays immediately
- **Total: ~2-3 minutes**

**Savings: ~10 minutes per check**

---

## Common Questions

### Q: What if I make a mistake entering the check?
**A:** Currently, you'll need to void it and create a new one. Editing coming soon!

### Q: Can multiple people pay from the same table?
**A:** Yes! They can split evenly, by item, or custom amounts.

### Q: What if someone already claimed an item?
**A:** It shows as "Already claimed" - can't be selected again.

### Q: Do I need to enter checks for takeout orders?
**A:** Only if you want them to pay via SplitPay. Otherwise, process normally.

### Q: Can I delete old checks?
**A:** Completed checks stay in history for accounting. You can filter by date.

### Q: What about cash payments?
**A:** SplitPay only handles card payments. Cash is handled separately.

---

## Upgrading to POS Integration Later

Once you're comfortable with manual mode, you can upgrade to automatic check syncing:

**Square Integration:**
- We connect to your Square POS
- Checks sync automatically
- No more manual entry!

**Toast Integration:**
- Connect to Toast POS
- Orders appear automatically

**Contact us** when you're ready to upgrade. Setup takes ~30 minutes.

---

## Support

**Issues or questions?**
- Email: support@splitpayusa.com
- Dashboard: Click your email → "Help"
- Phone: (coming soon)

**Common issues:**
- Can't login → Check email for magic link
- QR code not working → Regenerate QR code
- Payment failed → Check Stripe dashboard

---

## Success Metrics

Track these to measure success:

- **Transactions per day**
- **Average check size**
- **Split payment %** (how many guests split)
- **Tip %** (average tip percentage)
- **Time savings** (estimate 10 min saved per check)

All visible in "Transactions" dashboard!

---

## Next Steps

1. ✅ Onboard restaurant (script)
2. ✅ Manager sets up tables & QR codes
3. ✅ Test with one check
4. ✅ Go live with real guests!
5. ✅ Monitor transactions
6. 🔄 Collect feedback
7. 🚀 Upgrade to POS integration (optional)

**You're ready to go live!**

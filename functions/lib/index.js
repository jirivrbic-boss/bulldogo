"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireTopAds = exports.onChatMessageCreated = exports.createCheckoutSession = exports.createBillingPortalSession = exports.stripeInvoiceWebhook = exports.setAdminStatus = exports.deleteUserAuth = exports.sendWelcomeEmail = exports.sendNewMessageEmail = exports.sendProfileChangeEmail = exports.onPlanCancelled = exports.forceCheckExpiredPlans = exports.enforceExpiredPlanAds = exports.paymentReturn = exports.gopayNotification = exports.checkPayment = exports.createPayment = exports.cleanupInactiveUsers = exports.reportAd = exports.sendInactivityWarningEmails = exports.validateICO = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const nodemailer = __importStar(require("nodemailer"));
admin.initializeApp();
const corsHandler = (0, cors_1.default)({ origin: true });
function toDateMaybe(v) {
    if (!v)
        return null;
    if (v instanceof Date)
        return v;
    if (typeof (v === null || v === void 0 ? void 0 : v.toDate) === "function")
        return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}
function getUidFromProfileDocRef(ref) {
    var _a;
    // /users/{uid}/profile/profile
    const userDoc = (_a = ref.parent) === null || _a === void 0 ? void 0 : _a.parent;
    return userDoc ? userDoc.id : null;
}
function isPlanActive(profile, now) {
    if (!profile)
        return false;
    const plan = (profile.plan || "").toString();
    // Pokud plan není hobby nebo business, není aktivní
    if (!plan || plan === "none" || (plan !== "hobby" && plan !== "business"))
        return false;
    const end = toDateMaybe(profile.planPeriodEnd);
    const cancelAt = toDateMaybe(profile.planCancelAt);
    // Pokud planPeriodEnd neexistuje, považujeme plán za neaktivní (musí mít datum konce)
    if (!end)
        return false;
    // Pokud je konec v minulosti, plán vypršel
    if (now >= end)
        return false;
    // Pokud je nastavené zrušení a konec období, plán vypršel
    if (cancelAt && now >= end)
        return false;
    return true;
}
async function deleteAdReviewsAndDoc(adRef) {
    const db = admin.firestore();
    try {
        const reviewsSnap = await adRef.collection("reviews").get();
        if (!reviewsSnap.empty) {
            let batch = db.batch();
            let ops = 0;
            for (const r of reviewsSnap.docs) {
                batch.delete(r.ref);
                ops++;
                if (ops >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
            if (ops > 0)
                await batch.commit();
        }
    }
    catch (e) {
        functions.logger.debug("Ad reviews delete skipped or failed", { adId: adRef.id, error: e === null || e === void 0 ? void 0 : e.message });
    }
    await adRef.delete();
}
async function clearPlanExpiredMarkersForUser(userId) {
    const db = admin.firestore();
    const profileRef = db.collection("users").doc(userId).collection("profile").doc("profile");
    await profileRef.set({
        planExpiredAt: admin.firestore.FieldValue.delete(),
        planExpiredProcessedAt: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    const adsSnap = await db.collection(`users/${userId}/inzeraty`).where("inactiveReason", "==", "plan_expired").get();
    if (adsSnap.empty)
        return;
    let batch = db.batch();
    let ops = 0;
    for (const adDoc of adsSnap.docs) {
        batch.update(adDoc.ref, {
            inactiveReason: admin.firestore.FieldValue.delete(),
            inactiveAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        ops++;
        if (ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0)
        await batch.commit();
}
/**
 * validateICO
 * HTTPS endpoint, který proxy-uje dotaz na HlídačStátu a sjednotí odpověď.
 */
exports.validateICO = functions.region("europe-west1").https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e, _f;
        try {
            let networkError = false;
            const raw = (req.method === "GET"
                ? req.query.ico || req.query.ic || ""
                : ((_a = req.body) === null || _a === void 0 ? void 0 : _a.ico) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.ic) || "") || "";
            const ico = (raw || "").toString().replace(/\D+/g, "").slice(0, 8);
            if (ico.length !== 8) {
                res.status(200).json({ ok: false, reason: "IČO musí mít 8 číslic." });
                return;
            }
            // HlídačStátu API - endpoint pro firmy podle IČO
            const hlidacToken = ((_c = functions.config().hlidacstatu) === null || _c === void 0 ? void 0 : _c.api_token) || "36a6940d34774a5c90270f60ea73130b";
            try {
                const url = `https://api.hlidacstatu.cz/api/v2/firmy/ico/${ico}`;
                const hlidac = await axios_1.default.get(url, {
                    timeout: 7000,
                    headers: {
                        Accept: "application/json",
                        Authorization: `Token ${hlidacToken}`,
                        "User-Agent": "Bulldogo-Functions/1.0 (+https://bulldogo.cz)",
                    },
                });
                const data = hlidac.data || {};
                // HlídačStátu API vrací FirmaDTO: { ico, jmeno, datoveSchranky, zalozena }
                const companyName = data.jmeno || data.nazev || null;
                // Pokud API vrátilo data s IČO a jménem, firma existuje
                if (data.ico && companyName) {
                    res.status(200).json({ ok: true, ico, name: companyName, seat: null });
                    return;
                }
            }
            catch (err) {
                networkError = true;
                functions.logger.warn("HlídačStátu API call failed", { status: (_d = err === null || err === void 0 ? void 0 : err.response) === null || _d === void 0 ? void 0 : _d.status, code: err === null || err === void 0 ? void 0 : err.code, message: err === null || err === void 0 ? void 0 : err.message });
                // Pokud je 404, firma neexistuje
                if (((_e = err === null || err === void 0 ? void 0 : err.response) === null || _e === void 0 ? void 0 : _e.status) === 404) {
                    res.status(200).json({ ok: false, reason: "Subjekt s tímto IČO nebyl nalezen." });
                    return;
                }
            }
            if (networkError) {
                res.status(200).json({ ok: false, reason: "HlídačStátu je dočasně nedostupný. Zkuste to později." });
                return;
            }
            res.status(200).json({ ok: false, reason: "Subjekt s tímto IČO nebyl nalezen." });
        }
        catch (error) {
            const status = (_f = error === null || error === void 0 ? void 0 : error.response) === null || _f === void 0 ? void 0 : _f.status;
            if (status === 404) {
                res.status(200).json({ ok: false, reason: "Subjekt s tímto IČO nebyl nalezen." });
                return;
            }
            res.status(200).json({ ok: false, reason: "HlídačStátu je dočasně nedostupný. Zkuste to později." });
        }
    });
});
/**
 * Konfigurace pro mazání neaktivních účtů
 */
const INACTIVITY_WARNING_MONTHS = 5; // Po 5 měsících odeslat varování
const INACTIVITY_DELETE_MONTHS = 6; // Po 6 měsících smazat účet
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
/**
 * Formátuje datum do českého formátu
 */
function formatDateCzech(date) {
    const day = date.getDate();
    const months = [
        "ledna", "února", "března", "dubna", "května", "června",
        "července", "srpna", "září", "října", "listopadu", "prosince"
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}. ${month} ${year}`;
}
/**
 * Generuje HTML šablonu varovného emailu o neaktivitě
 */
function generateInactivityWarningEmailHTML(userName, deletionDate) {
    const formattedDate = formatDateCzech(deletionDate);
    const content = `
    <p class="text-primary" style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
      Všimli jsme si, že jste se na Bulldogo.cz dlouho nepřihlásili. Váš účet bude z důvodu neaktivity automaticky smazán dne <strong class="text-strong">${formattedDate}</strong>.
    </p>
    
    <div class="alert-warning" style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-warning-title" style="margin: 0 0 10px 0; font-size: 15px; color: #92400e; font-weight: 600;">
        ⚠️ Tato akce je nevratná!
      </p>
      <p class="alert-warning-text" style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">
        Po smazání budou trvale odstraněny všechny vaše údaje včetně profilu, inzerátů, recenzí a zpráv.
      </p>
    </div>
    
    <div class="alert-success" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-success-title" style="margin: 0 0 10px 0; font-size: 15px; color: #166534; font-weight: 600;">
        ✅ Jak zabránit smazání?
      </p>
      <p class="alert-success-text" style="margin: 0; font-size: 14px; color: #15803d; line-height: 1.6;">
        Stačí se přihlásit do svého účtu před datem smazání a váš účet zůstane aktivní. Žádné další kroky nejsou potřeba.
      </p>
    </div>
  `;
    return generateEmailTemplate({
        title: "⚠️ Váš účet bude smazán",
        userName,
        content,
        buttonText: "Přihlásit se",
        buttonUrl: "https://bulldogo.cz",
        footerText: "Máte otázky? Kontaktujte naši podporu na support@bulldogo.cz nebo +420 605 121 023."
    });
}
// Stará funkce - odstraněna, nahrazena univerzální šablonou
function generateInactivityWarningEmailHTML_OLD(userName, deletionDate) {
    const formattedDate = formatDateCzech(deletionDate);
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Upozornění na smazání účtu - Bulldogo.cz</title>
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #ffffff !important; }
  </style>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-container { background-color: #1a1a1a !important; }
      .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-text-light { color: #b0b0b0 !important; }
      .email-text-dark { color: #ffffff !important; }
      .email-title { color: #ffffff !important; }
      .email-border { border-color: #404040 !important; }
      .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
      .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
      .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    }
    [data-ogsc] .email-body { background-color: #1a1a1a !important; }
    [data-ogsc] .email-container { background-color: #1a1a1a !important; }
    [data-ogsc] .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
    [data-ogsc] .email-text { color: #e5e5e5 !important; }
    [data-ogsc] .email-text-light { color: #b0b0b0 !important; }
    [data-ogsc] .email-text-dark { color: #ffffff !important; }
    [data-ogsc] .email-title { color: #ffffff !important; }
    [data-ogsc] .email-border { border-color: #404040 !important; }
    [data-ogsc] .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    [data-ogsc] .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
    [data-ogsc] .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff; background: #ffffff; min-height: 100vh;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="background-color: #ffffff; background: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Hlavní kontejner -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo sekce -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(255, 106, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      B<span style="background: linear-gradient(90deg, #ffffff 0%, #ffd700 100%); -webkit-background-clip: text; background-clip: text;">ULLDOGO</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Hlavní karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                
                <!-- Červený header pruh (varování) -->
                <tr>
                  <td style="background: linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%); height: 8px;"></td>
                </tr>
                
                <!-- Ikona -->
                <tr>
                  <td align="center" style="padding: 40px 0 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 50%; width: 100px; height: 100px; text-align: center; line-height: 100px; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.2);">
                          <span style="font-size: 50px;">⚠️</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Pozdrav -->
                <tr>
                  <td align="center" style="padding: 0 40px 20px 40px;">
                    <h1 class="email-title" style="margin: 0; font-size: 26px; font-weight: 800; color: #dc2626; line-height: 1.3;">
                      Váš účet bude smazán
                    </h1>
                  </td>
                </tr>
                
                <!-- Hlavní text -->
                <tr>
                  <td align="center" style="padding: 0 40px 25px 40px;">
                    <p class="email-text" style="margin: 0 0 15px 0; font-size: 18px; line-height: 1.7; color: #4a5568;">
                      Ahoj, <strong class="email-text-dark" style="color: #1a1a2e;">${userName}</strong>!
                    </p>
                    <p class="email-text" style="margin: 0; font-size: 16px; line-height: 1.7; color: #718096;">
                      Všimli jsme si, že jste se na <strong class="email-text-dark" style="color: #1a1a2e;">Bulldogo.cz</strong> dlouho nepřihlásili. 
                      Váš účet bude z důvodu neaktivity <strong style="color: #dc2626;">automaticky smazán</strong>.
                    </p>
                  </td>
                </tr>
                
                <!-- Datum smazání -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-bg-light email-border" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid #fecaca;">
                      <tr>
                        <td align="center" style="padding: 25px;">
                          <p class="email-text-dark" style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 1px;">
                            Datum smazání účtu
                          </p>
                          <p style="margin: 0; font-size: 28px; font-weight: 800; color: #dc2626;">
                            ${formattedDate}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Varování -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
                      <tr>
                        <td style="padding: 20px;">
                          <p class="email-text-dark" style="margin: 0; font-size: 15px; line-height: 1.6; color: #92400e;">
                            <strong>⚠️ Tato akce je nevratná!</strong><br>
                            Po smazání budou trvale odstraněny všechny vaše údaje včetně profilu, inzerátů, recenzí a zpráv.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Jak zabránit -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; border: 1px solid #a7f3d0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p class="email-text-dark" style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">
                            ✅ Jak zabránit smazání?
                          </p>
                          <p class="email-text" style="margin: 0; font-size: 15px; line-height: 1.6; color: #047857;">
                            <strong>Stačí se přihlásit</strong> do svého účtu před datem smazání a váš účet zůstane aktivní. 
                            Žádné další kroky nejsou potřeba.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- CTA tlačítko -->
                <tr>
                  <td align="center" style="padding: 0 40px 30px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ff6a00 0%, #ffa62b 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(255, 106, 0, 0.35);">
                          <a href="https://bulldogo.cz/" target="_blank" style="display: inline-block; padding: 18px 50px; font-size: 17px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px;">
                            PŘIHLÁSIT SE →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Podpora -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <p class="email-text" style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      Máte otázky? Kontaktujte naši podporu na 
                      <a href="mailto:support@bulldogo.cz" style="color: #ff6a00; text-decoration: none; font-weight: 600;">support@bulldogo.cz</a>
                      nebo zavolejte na <a href="tel:+420605121023" style="color: #ff6a00; text-decoration: none; font-weight: 600;">+420 605 121 023</a>.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px;">
              <p class="email-text" style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                „Služby jednoduše. Pro každého."
              </p>
              <p class="email-text" style="margin: 0 0 20px 0; font-size: 13px; color: #4a5568;">
                <a href="https://bulldogo.cz" style="color: #ff6a00; text-decoration: none;">bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="mailto:support@bulldogo.cz" style="color: #ff6a00; text-decoration: none;">support@bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="tel:+420605121023" style="color: #ff6a00; text-decoration: none;">+420 605 121 023</a>
              </p>
              <p class="email-text-light" style="margin: 0; font-size: 12px; color: #6b7280;">
                © 2026 BULLDOGO. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Scheduled job: Odešle varovný email uživatelům neaktivním 5 měsíců
 * Spouští se denně v 3:00 ráno (hodinu před mazáním)
 */
exports.sendInactivityWarningEmails = functions
    .region("europe-west1")
    .pubsub.schedule("0 3 * * *")
    .timeZone("Europe/Prague")
    .onRun(async () => {
    const auth = admin.auth();
    const db = admin.firestore();
    // Cutoff pro 5 měsíců neaktivity
    const warningCutoff = Date.now() - INACTIVITY_WARNING_MONTHS * 30 * MILLIS_IN_DAY;
    // Cutoff pro 6 měsíců (aby se neposílalo těm, co už mají být smazáni)
    const deleteCutoff = Date.now() - INACTIVITY_DELETE_MONTHS * 30 * MILLIS_IN_DAY;
    let nextPageToken = undefined;
    let warnedCount = 0;
    do {
        const page = await auth.listUsers(1000, nextPageToken);
        for (const user of page.users) {
            const lastSignIn = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
            const created = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
            const lastActivity = lastSignIn || created;
            if (!lastActivity)
                continue;
            // Uživatel je neaktivní 5+ měsíců, ale méně než 6 měsíců
            if (lastActivity < warningCutoff && lastActivity >= deleteCutoff) {
                try {
                    // Zkontrolovat, zda jsme už varovný email neposlali
                    const profileDoc = await db.doc(`users/${user.uid}/profile/profile`).get();
                    const profileData = profileDoc.exists ? profileDoc.data() : null;
                    // Pokud už byl email odeslán v posledních 25 dnech, přeskočit
                    const lastWarningAt = profileData === null || profileData === void 0 ? void 0 : profileData.inactivityWarningAt;
                    if (lastWarningAt) {
                        const warningDate = lastWarningAt.toDate ? lastWarningAt.toDate() : new Date(lastWarningAt);
                        const daysSinceWarning = (Date.now() - warningDate.getTime()) / MILLIS_IN_DAY;
                        if (daysSinceWarning < 25) {
                            continue; // Email už byl nedávno odeslán
                        }
                    }
                    // Vypočítat datum smazání (30 dní od teď)
                    const deletionDate = new Date(Date.now() + 30 * MILLIS_IN_DAY);
                    // Získat email a jméno
                    const email = user.email;
                    if (!email)
                        continue;
                    let userName = "uživateli";
                    if (profileData) {
                        if (profileData.firstName) {
                            userName = profileData.firstName;
                        }
                        else if (profileData.name && profileData.name !== "Uživatel" && profileData.name !== "Firma") {
                            userName = profileData.name.split(" ")[0];
                        }
                        else if (profileData.companyName) {
                            userName = profileData.companyName;
                        }
                    }
                    // Odeslat varovný email
                    const mailOptions = {
                        from: {
                            name: "BULLDOGO",
                            address: "info@bulldogo.cz",
                        },
                        to: email,
                        subject: "⚠️ Váš účet na Bulldogo.cz bude smazán",
                        html: generateInactivityWarningEmailHTML(userName, deletionDate),
                        text: `Ahoj ${userName}!\n\nVšimli jsme si, že jste se na Bulldogo.cz dlouho nepřihlásili. Váš účet bude z důvodu neaktivity automaticky smazán dne ${formatDateCzech(deletionDate)}.\n\nTato akce je nevratná! Po smazání budou trvale odstraněny všechny vaše údaje.\n\nJak zabránit smazání? Stačí se přihlásit do svého účtu před datem smazání.\n\nPřihlásit se: https://bulldogo.cz\n\nMáte otázky? Kontaktujte podporu na support@bulldogo.cz nebo +420 605 121 023.\n\n© 2026 BULLDOGO`,
                    };
                    await smtpTransporter.sendMail(mailOptions);
                    // Uložit, že jsme email odeslali
                    await db.doc(`users/${user.uid}/profile/profile`).set({
                        inactivityWarningAt: admin.firestore.FieldValue.serverTimestamp(),
                        inactivityWarningEmail: email,
                    }, { merge: true });
                    warnedCount++;
                    functions.logger.info("📧 Varovný email o neaktivitě odeslán", {
                        uid: user.uid,
                        email: email,
                        deletionDate: deletionDate.toISOString(),
                    });
                }
                catch (err) {
                    functions.logger.error("Chyba při odesílání varovného emailu", {
                        uid: user.uid,
                        error: err === null || err === void 0 ? void 0 : err.message,
                    });
                }
            }
        }
        nextPageToken = page.pageToken;
    } while (nextPageToken);
    functions.logger.info("✅ sendInactivityWarningEmails finished", { warnedCount });
    return null;
});
/**
 * Mapování důvodů nahlášení na české popisky
 */
const reportReasonLabels = {
    spam: "Spam nebo podvodný inzerát",
    inappropriate: "Nevhodný obsah",
    misleading: "Zavádějící informace",
    wrong_category: "Špatná kategorie",
    duplicate: "Duplicitní inzerát",
    contact_issue: "Problém s kontaktem",
    other: "Jiný důvod",
};
/**
 * Generuje HTML šablonu emailu o nahlášení inzerátu (pro majitele)
 */
function generateReportEmailForOwnerHTML(ownerName, adTitle, adId, reporterName, reason, description) {
    const reasonLabel = reportReasonLabels[reason] || reason;
    const content = `
    <p class="text-primary" style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
      Uživatel nahlásil váš inzerát. Prosím zkontrolujte, zda je vše v pořádku.
    </p>
    
    <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="text-secondary" style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Nahlášený inzerát</p>
      <p class="text-primary" style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #111827;">${adTitle}</p>
      <p class="text-secondary" style="margin: 0; font-size: 13px; color: #9ca3af;">ID: ${adId}</p>
    </div>
    
    <div class="alert-warning" style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-warning-title" style="margin: 0 0 8px 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Důvod nahlášení</p>
      <p class="alert-warning-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">${reasonLabel}</p>
      ${description ? `<p class="alert-warning-text" style="margin: 12px 0 0 0; font-size: 14px; color: #78716c; border-top: 1px solid #fde68a; padding-top: 12px;">${description}</p>` : ""}
    </div>
    
    <p class="text-secondary" style="margin: 20px 0 10px 0; font-size: 14px; color: #6b7280;">
      <strong class="text-strong" style="color: #6b7280;">Nahlásil:</strong> ${reporterName}
    </p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #065f46;">✅ Co můžete udělat?</p>
      <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
        <li>Zkontrolujte obsah inzerátu</li>
        <li>Upravte případné nepřesnosti</li>
        <li>Pokud je vše v pořádku, nemusíte nic dělat</li>
      </ul>
    </div>
  `;
    return generateEmailTemplate({
        title: "⚠️ Váš inzerát byl nahlášen",
        userName: ownerName,
        content,
        buttonText: "Zkontrolovat mé inzeráty",
        buttonUrl: "https://bulldogo.cz/my-ads.html",
        footerText: "Máte otázky? Kontaktujte support@bulldogo.cz"
    });
}
// Stará funkce - odstraněna
function generateReportEmailForOwnerHTML_OLD(ownerName, adTitle, adId, reporterName, reason, description) {
    const reasonLabel = reportReasonLabels[reason] || reason;
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nahlášení inzerátu - Bulldogo.cz</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; min-height: 100vh;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(255, 106, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">BULLDOGO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <tr>
                  <td style="background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); height: 8px;"></td>
                </tr>
                
                <tr>
                  <td align="center" style="padding: 40px 0 20px 0;">
                    <span style="font-size: 50px;">⚠️</span>
                  </td>
                </tr>
                
                <tr>
                  <td align="center" style="padding: 0 40px 20px 40px;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #1a1a2e;">
                      Váš inzerát byl nahlášen
                    </h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; color: #4a5568;">
                      Ahoj, <strong>${ownerName}</strong>!
                    </p>
                    <p style="margin: 0; font-size: 16px; color: #718096;">
                      Uživatel nahlásil váš inzerát. Prosím zkontrolujte, zda je vše v pořádku.
                    </p>
                  </td>
                </tr>
                
                <!-- Detail inzerátu -->
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8f9fa; border-radius: 12px; border: 1px solid #e5e7eb;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Nahlášený inzerát</p>
                          <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1a1a2e;">${adTitle}</p>
                          <p style="margin: 0; font-size: 13px; color: #9ca3af;">ID: ${adId}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Důvod -->
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 8px 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Důvod nahlášení</p>
                          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">${reasonLabel}</p>
                          ${description ? `<p style="margin: 12px 0 0 0; font-size: 14px; color: #78716c; border-top: 1px solid #fde68a; padding-top: 12px;">${description}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Nahlašovatel -->
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      <strong>Nahlásil:</strong> ${reporterName}
                    </p>
                  </td>
                </tr>
                
                <!-- Co dělat -->
                <tr>
                  <td style="padding: 0 40px 25px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ecfdf5; border-radius: 12px; border: 1px solid #a7f3d0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #065f46;">✅ Co můžete udělat?</p>
                          <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
                            <li>Zkontrolujte obsah inzerátu</li>
                            <li>Upravte případné nepřesnosti</li>
                            <li>Pokud je vše v pořádku, nemusíte nic dělat</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- CTA -->
                <tr>
                  <td align="center" style="padding: 0 40px 30px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ff6a00 0%, #ffa62b 100%); border-radius: 12px;">
                          <a href="https://bulldogo.cz/my-ads.html" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none;">
                            ZKONTROLOVAT MÉ INZERÁTY →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Podpora -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      Máte otázky? Kontaktujte 
                      <a href="mailto:support@bulldogo.cz" style="color: #ff6a00;">support@bulldogo.cz</a>
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">© 2026 BULLDOGO. Všechna práva vyhrazena.</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Generuje HTML šablonu emailu o nahlášení inzerátu (pro admina)
 */
function generateReportEmailForAdminHTML(adTitle, adId, adOwnerName, adOwnerEmail, reporterName, reporterEmail, reason, description) {
    const reasonLabel = reportReasonLabels[reason] || reason;
    const content = `
    <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="text-secondary" style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">📋 Nahlášený inzerát</p>
      <p class="text-primary" style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700;">${adTitle}</p>
      <p class="text-secondary" style="margin: 0 0 8px 0; font-size: 13px;">ID: ${adId}</p>
      <p style="margin: 0;"><a href="https://bulldogo.cz/ad-detail.html?id=${adId}" style="color: #f77c00; text-decoration: none;">Zobrazit inzerát →</a></p>
              </div>
              
    <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="text-secondary" style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">👤 Majitel inzerátu</p>
      <p class="text-primary" style="margin: 0 0 4px 0; font-size: 15px;"><strong class="text-strong">Jméno:</strong> ${adOwnerName}</p>
      <p class="alert-info-text" style="margin: 0; font-size: 14px;"><strong class="text-strong">Email:</strong> <a href="mailto:${adOwnerEmail}" style="color: #f77c00;">${adOwnerEmail || "Neznámý"}</a></p>
              </div>
              
    <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="text-secondary" style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">🔔 Nahlašovatel</p>
      <p class="text-primary" style="margin: 0 0 4px 0; font-size: 15px;"><strong class="text-strong">Jméno:</strong> ${reporterName}</p>
      <p class="alert-info-text" style="margin: 0; font-size: 14px;"><strong class="text-strong">Email:</strong> <a href="mailto:${reporterEmail}" style="color: #f77c00;">${reporterEmail || "Nepřihlášený"}</a></p>
              </div>
              
    <div class="alert-warning" style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-warning-title" style="margin: 0 0 8px 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ Důvod nahlášení</p>
      <p class="alert-warning-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e;">${reasonLabel}</p>
      ${description ? `<p class="alert-warning-text" style="margin: 12px 0 0 0; font-size: 14px; color: #78716c; border-top: 1px solid #fde68a; padding-top: 12px;">${description}</p>` : ""}
              </div>
  `;
    return generateEmailTemplate({
        title: "🚨 Nové nahlášení inzerátu",
        userName: "Admin",
        content,
        buttonText: "Zobrazit inzerát",
        buttonUrl: `https://bulldogo.cz/ad-detail.html?id=${adId}`,
        footerText: "Tento email byl automaticky vygenerován systémem Bulldogo.cz"
    });
}
/**
 * HTTPS endpoint pro nahlášení inzerátu
 */
exports.reportAd = functions.region("europe-west1").https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        try {
            if (req.method !== "POST") {
                res.status(405).json({ success: false, error: "Method not allowed" });
                return;
            }
            const { adId, adTitle, adOwnerId, adOwnerName, adOwnerEmail, reporterUid, reporterName, reporterEmail, reason, description, } = req.body;
            if (!adId || !reason) {
                res.status(400).json({ success: false, error: "Missing required fields" });
                return;
            }
            const db = admin.firestore();
            // Get owner email from Firestore if not provided
            let ownerEmail = adOwnerEmail;
            let ownerName = adOwnerName || "Majitel inzerátu";
            if (adOwnerId && !ownerEmail) {
                try {
                    const ownerProfile = await db.doc(`users/${adOwnerId}/profile/profile`).get();
                    if (ownerProfile.exists) {
                        const data = ownerProfile.data();
                        ownerEmail = (data === null || data === void 0 ? void 0 : data.email) || "";
                        ownerName = (data === null || data === void 0 ? void 0 : data.name) || (data === null || data === void 0 ? void 0 : data.firstName) || (data === null || data === void 0 ? void 0 : data.companyName) || ownerName;
                    }
                }
                catch (e) {
                    functions.logger.debug("Could not fetch owner profile", { adOwnerId });
                }
            }
            // Save report to Firestore
            await db.collection("reports").add({
                adId,
                adTitle: adTitle || "",
                adOwnerId: adOwnerId || "",
                adOwnerEmail: ownerEmail || "",
                reporterUid: reporterUid || "",
                reporterName: reporterName || "Anonymní",
                reporterEmail: reporterEmail || "",
                reason,
                description: description || "",
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Send email to ad owner
            if (ownerEmail) {
                try {
                    await smtpTransporter.sendMail({
                        from: { name: "BULLDOGO", address: "info@bulldogo.cz" },
                        to: ownerEmail,
                        subject: `⚠️ Váš inzerát "${adTitle}" byl nahlášen`,
                        html: generateReportEmailForOwnerHTML(ownerName, adTitle || "Bez názvu", adId, reporterName || "Anonymní uživatel", reason, description || ""),
                    });
                    functions.logger.info("Report email sent to owner", { ownerEmail, adId });
                }
                catch (e) {
                    functions.logger.error("Failed to send report email to owner", { error: e === null || e === void 0 ? void 0 : e.message });
                }
            }
            // Send copy to admin
            try {
                await smtpTransporter.sendMail({
                    from: { name: "BULLDOGO", address: "info@bulldogo.cz" },
                    to: "support@bulldogo.cz",
                    subject: `🚨 Nahlášení inzerátu: ${adTitle}`,
                    html: generateReportEmailForAdminHTML(adTitle || "Bez názvu", adId, ownerName, ownerEmail || "", reporterName || "Anonymní", reporterEmail || "", reason, description || ""),
                });
                functions.logger.info("Report email sent to admin", { adId });
            }
            catch (e) {
                functions.logger.error("Failed to send report email to admin", { error: e === null || e === void 0 ? void 0 : e.message });
            }
            res.status(200).json({ success: true });
        }
        catch (error) {
            functions.logger.error("Report ad error", { error: error === null || error === void 0 ? void 0 : error.message });
            res.status(500).json({ success: false, error: (error === null || error === void 0 ? void 0 : error.message) || "Internal error" });
        }
    });
});
/**
 * Generuje HTML šablonu emailu o smazání účtu
 */
function generateAccountDeletedEmailHTML(userName) {
    const content = `
    <p class="text-primary" style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
      Váš účet na Bulldogo.cz byl z důvodu dlouhodobé neaktivity <strong class="text-strong">trvale smazán</strong>.
                    </p>
    
    <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="text-primary" style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">Co bylo smazáno:</p>
      <ul class="alert-info-text" style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                            <li>Váš profil a osobní údaje</li>
                            <li>Všechny vaše inzeráty</li>
                            <li>Recenze a hodnocení</li>
                            <li>Zprávy a konverzace</li>
                          </ul>
    </div>
    
    <div class="alert-danger" style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-danger-text" style="margin: 0; font-size: 15px; color: #991b1b; line-height: 1.6;">
        <strong class="text-strong" style="color: #991b1b;">⚠️ Tato akce je nevratná.</strong> Data již nelze obnovit.
                          </p>
    </div>
    
    <div class="alert-warning" style="background: #fff8eb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-warning-title" style="margin: 0 0 10px 0; font-size: 16px; color: #92400e; font-weight: 600;">
        🧡 Děkujeme, že jste byli součástí Bulldogo!
                          </p>
      <p class="alert-warning-text" style="margin: 0; font-size: 14px; color: #b45309; line-height: 1.6;">
                            Pokud se rozhodnete vrátit, budeme rádi. Můžete si kdykoliv vytvořit nový účet.
                          </p>
    </div>
  `;
    return generateEmailTemplate({
        title: "👋 Váš účet byl smazán",
        userName,
        content,
        buttonText: "Vytvořit nový účet",
        buttonUrl: "https://bulldogo.cz"
    });
}
/**
 * Odešle email o smazání účtu
 */
async function sendAccountDeletedEmail(email, userName) {
    const mailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: email,
        subject: "👋 Váš účet na Bulldogo.cz byl smazán",
        html: generateAccountDeletedEmailHTML(userName),
        text: `Ahoj ${userName}!\n\nVáš účet na Bulldogo.cz byl z důvodu dlouhodobé neaktivity trvale smazán.\n\nCo bylo smazáno:\n- Váš profil a osobní údaje\n- Všechny vaše inzeráty\n- Recenze a hodnocení\n- Zprávy a konverzace\n\n⚠️ Tato akce je nevratná. Data již nelze obnovit.\n\n🧡 Děkujeme, že jste byli součástí Bulldogo! Pokud se rozhodnete vrátit, můžete si kdykoliv vytvořit nový účet na https://bulldogo.cz\n\n© 2026 BULLDOGO`,
    };
    await smtpTransporter.sendMail(mailOptions);
}
/**
 * Scheduled cleanup of inactive accounts.
 * Smaže účty, které se nepřihlásily déle než 6 měsíců,
 * včetně základních dat ve Firestore (profil, inzeráty, recenze, zprávy).
 */
async function deleteUserData(uid) {
    const db = admin.firestore();
    functions.logger.info("🧹 Deleting data for inactive user", { uid });
    try {
        await db.doc(`users/${uid}/profile/profile`).delete({ exists: true });
    }
    catch (err) {
        functions.logger.debug("Profile delete skipped or failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        const adsSnap = await db.collection(`users/${uid}/inzeraty`).get();
        for (const adDoc of adsSnap.docs) {
            try {
                const reviewsSnap = await adDoc.ref.collection("reviews").get();
                if (!reviewsSnap.empty) {
                    let batch = db.batch();
                    let ops = 0;
                    for (const r of reviewsSnap.docs) {
                        batch.delete(r.ref);
                        ops++;
                        if (ops >= 450) {
                            await batch.commit();
                            batch = db.batch();
                            ops = 0;
                        }
                    }
                    if (ops > 0)
                        await batch.commit();
                }
            }
            catch (err) {
                functions.logger.debug("Ad reviews delete skipped or failed", { uid, adId: adDoc.id, error: err === null || err === void 0 ? void 0 : err.message });
            }
            await adDoc.ref.delete();
        }
    }
    catch (err) {
        functions.logger.debug("Ads delete skipped or failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        const profileReviewsSnap = await db.collection(`users/${uid}/reviews`).get();
        if (!profileReviewsSnap.empty) {
            const batch = db.batch();
            profileReviewsSnap.forEach((r) => batch.delete(r.ref));
            await batch.commit();
        }
    }
    catch (err) {
        functions.logger.debug("User reviews subcollection delete failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        // Recenze kde je uživatel recenzovaný
        const reviewedSnap = await db.collection("reviews").where("reviewedUserId", "==", uid).get();
        if (!reviewedSnap.empty) {
            const batch = db.batch();
            reviewedSnap.forEach((r) => batch.delete(r.ref));
            await batch.commit();
        }
        // Recenze kde je uživatel recenzující
        const reviewerSnap = await db.collection("reviews").where("reviewerId", "==", uid).get();
        if (!reviewerSnap.empty) {
            const batch = db.batch();
            reviewerSnap.forEach((r) => batch.delete(r.ref));
            await batch.commit();
        }
    }
    catch (err) {
        functions.logger.debug("Root reviews delete failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        // Zprávy kde je uživatel odesílatel
        const messagesFromSnap = await db.collection("messages").where("userId", "==", uid).get();
        if (!messagesFromSnap.empty) {
            const batch = db.batch();
            messagesFromSnap.forEach((m) => batch.delete(m.ref));
            await batch.commit();
        }
        // Zprávy kde je uživatel příjemce
        const messagesToSnap = await db.collection("messages").where("recipientId", "==", uid).get();
        if (!messagesToSnap.empty) {
            const batch = db.batch();
            messagesToSnap.forEach((m) => batch.delete(m.ref));
            await batch.commit();
        }
    }
    catch (err) {
        functions.logger.debug("Messages delete failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        // Konverzace kde je uživatel účastník
        const conversationsSnap = await db.collection("conversations").where("participants", "array-contains", uid).get();
        if (!conversationsSnap.empty) {
            const batch = db.batch();
            conversationsSnap.forEach((c) => batch.delete(c.ref));
            await batch.commit();
        }
    }
    catch (err) {
        functions.logger.debug("Conversations delete failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
    try {
        await db.doc(`users/${uid}`).delete({ exists: true });
    }
    catch (err) {
        functions.logger.debug("Root user doc delete skipped or failed", { uid, error: err === null || err === void 0 ? void 0 : err.message });
    }
}
exports.cleanupInactiveUsers = functions
    .region("europe-west1")
    .pubsub.schedule("0 4 * * *")
    .timeZone("Europe/Prague")
    .onRun(async () => {
    var _a, _b;
    const auth = admin.auth();
    const db = admin.firestore();
    const cutoff = Date.now() - INACTIVITY_DELETE_MONTHS * 30 * MILLIS_IN_DAY;
    let nextPageToken = undefined;
    let deletedCount = 0;
    do {
        const page = await auth.listUsers(1000, nextPageToken);
        for (const user of page.users) {
            const lastSignIn = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
            const created = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : 0;
            const lastActivity = lastSignIn || created;
            if (!lastActivity)
                continue;
            if (lastActivity < cutoff) {
                functions.logger.info("🧹 Deleting inactive auth user", {
                    uid: user.uid,
                    email: (_a = user.email) !== null && _a !== void 0 ? _a : null,
                    lastSignIn: (_b = user.metadata.lastSignInTime) !== null && _b !== void 0 ? _b : user.metadata.creationTime,
                });
                // Získat jméno uživatele před smazáním pro email
                let userName = "uživateli";
                const email = user.email;
                try {
                    const profileDoc = await db.doc(`users/${user.uid}/profile/profile`).get();
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        if (profileData === null || profileData === void 0 ? void 0 : profileData.firstName) {
                            userName = profileData.firstName;
                        }
                        else if ((profileData === null || profileData === void 0 ? void 0 : profileData.name) && profileData.name !== "Uživatel" && profileData.name !== "Firma") {
                            userName = profileData.name.split(" ")[0];
                        }
                        else if (profileData === null || profileData === void 0 ? void 0 : profileData.companyName) {
                            userName = profileData.companyName;
                        }
                    }
                }
                catch (e) {
                    // Ignorovat chyby při získávání jména
                }
                // Smazat data uživatele
                try {
                    await deleteUserData(user.uid);
                }
                catch (err) {
                    functions.logger.error("Failed to delete Firestore data for inactive user", { uid: user.uid, error: err === null || err === void 0 ? void 0 : err.message });
                }
                // Smazat Auth účet
                try {
                    await auth.deleteUser(user.uid);
                    deletedCount += 1;
                    // Odeslat email o smazání účtu (po úspěšném smazání)
                    if (email) {
                        try {
                            await sendAccountDeletedEmail(email, userName);
                            functions.logger.info("📧 Email o smazání účtu odeslán", { email, userName });
                        }
                        catch (emailErr) {
                            functions.logger.error("Failed to send account deleted email", { email, error: emailErr === null || emailErr === void 0 ? void 0 : emailErr.message });
                        }
                    }
                }
                catch (err) {
                    functions.logger.error("Failed to delete auth user", { uid: user.uid, error: err === null || err === void 0 ? void 0 : err.message });
                }
            }
        }
        nextPageToken = page.pageToken;
    } while (nextPageToken);
    functions.logger.info("✅ cleanupInactiveUsers finished", { deletedCount, inactivityMonths: INACTIVITY_DELETE_MONTHS });
    return null;
});
const getGoPayConfig = () => {
    const cfg = functions.config().gopay || {};
    const isTest = process.env.NODE_ENV !== "production" || cfg.use_test === "true";
    return {
        clientId: isTest ? (cfg.test_client_id || "") : (cfg.client_id || ""),
        clientSecret: isTest ? (cfg.test_client_secret || "") : (cfg.client_secret || ""),
        apiUrl: isTest ? (cfg.test_api_url || "https://gw.sandbox.gopay.com/api") : (cfg.api_url || "https://gate.gopay.cz/api"),
        isTest,
    };
};
async function getGoPayAccessToken(scope = "payment-create") {
    var _a, _b, _c, _d, _e;
    const gopayConfig = getGoPayConfig();
    if (!gopayConfig.clientId || !gopayConfig.clientSecret) {
        throw new Error("GoPay credentials not configured. Please set gopay.client_id and gopay.client_secret");
    }
    try {
        const response = await axios_1.default.post(`${gopayConfig.apiUrl}/oauth2/token`, null, {
            auth: {
                username: gopayConfig.clientId,
                password: gopayConfig.clientSecret,
            },
            params: {
                grant_type: "client_credentials",
                scope,
            },
        });
        return response.data.access_token;
    }
    catch (error) {
        functions.logger.error("GoPay OAuth2 error", { details: ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || (error === null || error === void 0 ? void 0 : error.message) });
        const msg = ((_e = (_d = (_c = (_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.errors) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) || (error === null || error === void 0 ? void 0 : error.message) || "unknown";
        throw new Error(`Failed to get GoPay access token: ${msg}`);
    }
}
/**
 * Generuje HTML šablonu faktury
 */
function generateInvoiceHTML(orderNumber, planName, amount, currency, userName, invoiceDate, userId, userEmail, userPhone, ico, dic, companyName) {
    const formattedDate = invoiceDate.toLocaleDateString("cs-CZ", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const formattedAmount = new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: currency || "CZK",
    }).format(amount);
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Faktura ${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="700" cellspacing="0" cellpadding="0" style="max-width: 700px; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px; background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      BULLDOGO.CZ
                    </h1>
                    <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffffff; font-weight: 600;">
                      FAKTURA
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 500;">
                      Číslo: ${orderNumber}
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                      Datum vystavení: ${formattedDate}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dodavatel -->
          <tr>
            <td style="padding: 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 50%; vertical-align: top;">
                    <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #2c3e50; font-weight: 700; text-transform: uppercase;">
                      Dodavatel
                    </h2>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                      <strong>Dominik Hašek</strong><br>
                      Bulldogo.cz<br>
                      IČO 17059470<br>
                      <br>
                      Jiřího Z Poděbrad 2017<br>
                      Sokolov<br>
                      356 01<br>
                      Email: ucetni@bulldogo.cz
                    </p>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #2c3e50; font-weight: 700; text-transform: uppercase;">
                      Odběratel
                    </h2>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151; line-height: 1.6;">
                      <strong>${userName}</strong><br>
                      UID: ${userId}<br>
                      ${userEmail ? `Email: ${userEmail}<br>` : ""}
                      ${userPhone ? `Telefon: ${userPhone}<br>` : ""}
                      ${companyName ? `Firma: ${companyName}<br>` : ""}
                      ${ico ? `IČO: ${ico}<br>` : ""}
                      ${dic ? `DIČ: ${dic}<br>` : ""}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Položky -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <td style="padding: 12px; text-align: left; font-weight: 700; color: #2c3e50; font-size: 14px;">Položka</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #2c3e50; font-size: 14px;">Množství</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #2c3e50; font-size: 14px;">Cena</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #2c3e50; font-size: 14px;">Celkem</td>
                </tr>
                <tr>
                  <td style="padding: 15px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
                    ${planName}
                  </td>
                  <td style="padding: 15px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151; font-size: 14px;">
                    1 ks
                  </td>
                  <td style="padding: 15px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151; font-size: 14px;">
                    ${formattedAmount}
                  </td>
                  <td style="padding: 15px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151; font-size: 14px; font-weight: 600;">
                    ${formattedAmount}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Celkem -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="right">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-left: auto;">
                      <tr>
                        <td style="padding: 8px 20px; text-align: right; font-size: 14px; color: #6b7280;">Celkem k úhradě:</td>
                        <td style="padding: 8px 0 8px 20px; text-align: right; font-size: 20px; font-weight: 700; color: #f77c00;">
                          ${formattedAmount}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #f9fafb; border-radius: 0 0 12px 12px; border-top: 2px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                <strong>Platební údaje:</strong><br>
                Bankovní účet: 277067486/0600<br>
                Variabilní symbol: ${orderNumber}
              </p>
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                Tato faktura byla vygenerována automaticky po úspěšné platbě.<br>
                © 2026 BULLDOGO.CZ - Všechna práva vyhrazena.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Odešle fakturu na email uživatele a účetní (pro Stripe)
 */
// VYPNUTO - Stripe automaticky generuje faktury, tato funkce se nepoužívá
// @ts-ignore - unused function, kept for potential future use
async function sendStripeInvoiceEmail(subscriptionId, userId, subscriptionData) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const db = admin.firestore();
    // Načíst profil uživatele pro email a údaje
    const userProfileDoc = await db.collection("users").doc(userId).collection("profile").doc("profile").get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : null;
    // Načíst customer data pro email
    const customerDoc = await db.collection("customers").doc(userId).get();
    const customerData = customerDoc.exists ? customerDoc.data() : null;
    const userEmail = (customerData === null || customerData === void 0 ? void 0 : customerData.email) || (userProfile === null || userProfile === void 0 ? void 0 : userProfile.email);
    if (!userEmail) {
        functions.logger.warn("No email found for invoice", { subscriptionId, userId });
        return;
    }
    // Získat všechny informace z profilu
    const firstName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.firstName) || "";
    const lastName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.lastName) || "";
    const name = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.name) || "";
    const companyName = userProfile === null || userProfile === void 0 ? void 0 : userProfile.companyName;
    const phone = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.phone) || (userProfile === null || userProfile === void 0 ? void 0 : userProfile.phoneNumber) || "";
    const ico = userProfile === null || userProfile === void 0 ? void 0 : userProfile.ico;
    const dic = userProfile === null || userProfile === void 0 ? void 0 : userProfile.dic;
    // Sestavit jméno a příjmení
    let userName = "";
    if (firstName && lastName) {
        userName = `${firstName} ${lastName}`;
    }
    else if (name && name !== "Uživatel" && name !== "Firma") {
        userName = name;
    }
    else if (companyName) {
        userName = companyName;
    }
    else {
        userName = "Jméno Příjmení"; // Fallback pokud není jméno
    }
    // Získat informace o plánu z subscription
    const planName = ((_d = (_c = (_b = (_a = subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.items) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.price) === null || _c === void 0 ? void 0 : _c.product) === null || _d === void 0 ? void 0 : _d.name) ||
        ((_e = subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.product) === null || _e === void 0 ? void 0 : _e.name) ||
        "Balíček";
    // Získat cenu (Stripe ukládá ceny v centech)
    const amountInCents = ((_h = (_g = (_f = subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.items) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.price) === null || _h === void 0 ? void 0 : _h.unit_amount) ||
        (subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.amount) || 0;
    const amount = amountInCents / 100; // převod z centů na koruny
    const currency = ((_j = subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.currency) === null || _j === void 0 ? void 0 : _j.toUpperCase()) || "CZK";
    // Použít subscription ID jako číslo faktury
    const invoiceNumber = subscriptionId.substring(0, 12); // zkrátit na rozumnou délku
    const invoiceDate = new Date();
    const invoiceHTML = generateInvoiceHTML(invoiceNumber, planName, amount, currency, userName, invoiceDate, userId, userEmail, phone, ico, dic, companyName);
    // Odeslat fakturu uživateli
    const userMailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: userEmail,
        subject: `Faktura ${invoiceNumber} - ${planName} - Bulldogo.cz`,
        html: invoiceHTML,
        text: `Faktura ${invoiceNumber} pro ${userName}\n\nEmail: ${userEmail || "neuvedeno"}\nTelefon: ${phone || "neuvedeno"}\nČástka: ${amount} ${currency}\nBalíček: ${planName}\n\n© 2026 BULLDOGO.CZ`,
    };
    await smtpTransporter.sendMail(userMailOptions);
    functions.logger.info("✅ Faktura odeslána uživateli", { subscriptionId, userEmail, userId, userName });
    // Odeslat fakturu také na účetní email
    const accountingEmail = "ucetni@bulldogo.cz";
    const accountingMailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: accountingEmail,
        subject: `Faktura ${invoiceNumber} - ${userName} (UID: ${userId})`,
        html: invoiceHTML,
        text: `Faktura ${invoiceNumber} pro ${userName}\n\nUID: ${userId}\nEmail: ${userEmail || "neuvedeno"}\nTelefon: ${phone || "neuvedeno"}\nČástka: ${amount} ${currency}\nBalíček: ${planName}\n\n© 2026 BULLDOGO.CZ`,
    };
    await smtpTransporter.sendMail(accountingMailOptions);
    functions.logger.info("✅ Faktura odeslána účetní", { subscriptionId, accountingEmail, userId, userName });
}
/**
 * Odešle fakturu za topování na email účetní
 */
// VYPNUTO - Stripe automaticky generuje faktury, tato funkce se nepoužívá
// @ts-ignore - unused function, kept for potential future use
async function sendTopAdInvoiceEmail(sessionId, userId, checkoutData) {
    const db = admin.firestore();
    // Načíst profil uživatele pro email a údaje
    const userProfileDoc = await db.collection("users").doc(userId).collection("profile").doc("profile").get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : null;
    // Načíst customer data pro email
    const customerDoc = await db.collection("customers").doc(userId).get();
    const customerData = customerDoc.exists ? customerDoc.data() : null;
    const userEmail = (customerData === null || customerData === void 0 ? void 0 : customerData.email) || (userProfile === null || userProfile === void 0 ? void 0 : userProfile.email);
    if (!userEmail) {
        functions.logger.warn("No email found for top ad invoice", { sessionId, userId });
        return;
    }
    // Získat všechny informace z profilu
    const firstName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.firstName) || "";
    const lastName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.lastName) || "";
    const name = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.name) || "";
    const companyName = userProfile === null || userProfile === void 0 ? void 0 : userProfile.companyName;
    const phone = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.phone) || (userProfile === null || userProfile === void 0 ? void 0 : userProfile.phoneNumber) || "";
    const ico = userProfile === null || userProfile === void 0 ? void 0 : userProfile.ico;
    const dic = userProfile === null || userProfile === void 0 ? void 0 : userProfile.dic;
    // Sestavit jméno a příjmení
    let userName = "";
    if (firstName && lastName) {
        userName = `${firstName} ${lastName}`;
    }
    else if (name && name !== "Uživatel" && name !== "Firma") {
        userName = name;
    }
    else if (companyName) {
        userName = companyName;
    }
    else {
        userName = "Jméno Příjmení"; // Fallback pokud není jméno
    }
    // Získat metadata z checkout session
    const metadata = (checkoutData === null || checkoutData === void 0 ? void 0 : checkoutData.metadata) || {};
    const adId = metadata === null || metadata === void 0 ? void 0 : metadata.adId;
    const duration = (metadata === null || metadata === void 0 ? void 0 : metadata.duration) || "neuvedeno";
    // Určit název položky podle délky topování
    let planName = "Topování inzerátu";
    if (duration === "oneday") {
        planName = "Topování inzerátu - 1 den";
    }
    else if (duration === "oneweek") {
        planName = "Topování inzerátu - 1 týden";
    }
    else if (duration === "onemonth") {
        planName = "Topování inzerátu - 1 měsíc";
    }
    // Získat cenu z checkout session (Stripe ukládá ceny v centech)
    const amountInCents = (checkoutData === null || checkoutData === void 0 ? void 0 : checkoutData.amount_total) || (checkoutData === null || checkoutData === void 0 ? void 0 : checkoutData.amount) || 0;
    const amount = amountInCents / 100; // převod z centů na koruny
    const currency = ((checkoutData === null || checkoutData === void 0 ? void 0 : checkoutData.currency) || "CZK").toUpperCase();
    // Použít session ID jako číslo faktury
    const invoiceNumber = `TOP-${sessionId.substring(0, 10)}`;
    const invoiceDate = new Date();
    const invoiceHTML = generateInvoiceHTML(invoiceNumber, planName, amount, currency, userName, invoiceDate, userId, userEmail, phone, ico, dic, companyName);
    // Odeslat fakturu pouze na účetní email
    const accountingEmail = "ucetni@bulldogo.cz";
    const accountingMailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: accountingEmail,
        subject: `Faktura ${invoiceNumber} - Topování inzerátu - ${userName} (UID: ${userId})`,
        html: invoiceHTML,
        text: `Faktura ${invoiceNumber} pro ${userName}\n\nUID: ${userId}\nEmail: ${userEmail || "neuvedeno"}\nTelefon: ${phone || "neuvedeno"}\nČástka: ${amount} ${currency}\nTopování: ${planName}\nAd ID: ${adId || "neuvedeno"}\n\n© 2026 BULLDOGO.CZ`,
    };
    await smtpTransporter.sendMail(accountingMailOptions);
    functions.logger.info("✅ Faktura za topování odeslána účetní", { sessionId, accountingEmail, userId, userName, adId, amount });
}
/**
 * Pomocná funkce pro aktivaci uživatelského plánu po zaplacení
 */
async function activateUserPlan(orderNumber) {
    const db = admin.firestore();
    const paymentDoc = await db.collection("payments").doc(orderNumber).get();
    if (!paymentDoc.exists) {
        functions.logger.error("Payment document not found", { orderNumber });
        return;
    }
    const paymentData = paymentDoc.data();
    if (!paymentData) {
        functions.logger.error("Payment data is empty", { orderNumber });
        return;
    }
    const { userId, planId, planName, state } = paymentData;
    if (state !== "PAID") {
        functions.logger.info("Payment not paid yet", { orderNumber, state });
        return;
    }
    if (paymentData.planActivated) {
        functions.logger.info("Plan already activated", { orderNumber });
        return;
    }
    if (!userId || !planId) {
        functions.logger.error("Missing userId or planId", { orderNumber });
        return;
    }
    const userProfileRef = db.collection("users").doc(userId).collection("profile").doc("profile");
    const now = admin.firestore.Timestamp.now();
    const durationDays = 30;
    const periodEnd = new Date(now.toDate());
    periodEnd.setDate(periodEnd.getDate() + durationDays);
    await userProfileRef.set({
        plan: planId,
        planName,
        planUpdatedAt: now,
        planPeriodStart: now,
        planPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        planDurationDays: durationDays,
        planCancelAt: null,
    }, { merge: true });
    // Odstranit expirační značky (pokud uživatel obnovil balíček)
    try {
        await clearPlanExpiredMarkersForUser(String(userId));
    }
    catch (e) {
        functions.logger.warn("Failed clearing plan expired markers", { userId, error: e === null || e === void 0 ? void 0 : e.message });
    }
    await paymentDoc.ref.update({
        planActivated: true,
        planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.info("Plan activated for user", { userId, planId });
}
/**
 * Vytvoří platbu v GoPay
 */
exports.createPayment = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed. Use POST." });
                return;
            }
            const body = (req.body || {});
            const { amount, currency = "CZK", orderNumber, orderDescription, userId, planId, planName, items = [], payerEmail, payerPhone, payerFirstName, payerLastName, returnUrl, } = body;
            if (!amount || !orderNumber || !orderDescription || !userId || !planId || !planName) {
                res.status(400).json({
                    error: "Missing required fields: amount, orderNumber, orderDescription, userId, planId, planName",
                });
                return;
            }
            if (amount <= 0) {
                res.status(400).json({ error: "Amount must be greater than 0" });
                return;
            }
            const accessToken = await getGoPayAccessToken("payment-create");
            const gopayConfig = getGoPayConfig();
            const projCfg = functions.config().project || {};
            const baseUrl = returnUrl || `https://${projCfg.region || "europe-west1"}-${projCfg.id || ""}.cloudfunctions.net`;
            const paymentReturnUrl = returnUrl || `${baseUrl}/paymentReturn`;
            const paymentNotificationUrl = `${baseUrl}/gopayNotification`;
            const paymentData = {
                amount: Math.round(Number(amount) * 100),
                currency,
                order_number: orderNumber,
                order_description: orderDescription,
                items: Array.isArray(items) && items.length > 0
                    ? items
                    : [
                        {
                            name: planName,
                            amount: Math.round(Number(amount) * 100),
                            count: 1,
                        },
                    ],
                payer: {
                    allowed_payment_instruments: ["PAYMENT_CARD", "BANK_ACCOUNT"],
                    default_payment_instrument: "PAYMENT_CARD",
                    contact: Object.assign(Object.assign(Object.assign(Object.assign({}, (payerEmail ? { email: payerEmail } : {})), (payerPhone ? { phone_number: payerPhone } : {})), (payerFirstName ? { first_name: payerFirstName } : {})), (payerLastName ? { last_name: payerLastName } : {})),
                },
                target: { type: "ACCOUNT", goid: parseInt(gopayConfig.clientId, 10) },
                return_url: paymentReturnUrl,
                notification_url: paymentNotificationUrl,
                lang: "cs",
            };
            const paymentResponse = await axios_1.default.post(`${gopayConfig.apiUrl}/payments/payment`, paymentData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            const goPayPayment = paymentResponse.data;
            const paymentRecord = {
                gopayId: goPayPayment.id,
                orderNumber,
                userId,
                planId,
                planName,
                amount,
                currency,
                state: goPayPayment.state || "CREATED",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                gopayResponse: goPayPayment,
            };
            await admin.firestore().collection("payments").doc(orderNumber).set(paymentRecord);
            res.status(200).json({
                success: true,
                paymentId: goPayPayment.id,
                orderNumber,
                gwUrl: goPayPayment.gw_url,
                state: goPayPayment.state,
            });
        }
        catch (error) {
            res.status(500).json({
                error: "Failed to create payment",
                message: error === null || error === void 0 ? void 0 : error.message,
                details: ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || undefined,
            });
        }
    });
});
/**
 * Ověří stav platby v GoPay
 */
exports.checkPayment = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            const paymentId = req.query.paymentId || "";
            const orderNumber = req.query.orderNumber || "";
            if (!paymentId && !orderNumber) {
                res.status(400).json({ error: "Missing paymentId or orderNumber" });
                return;
            }
            const accessToken = await getGoPayAccessToken("payment-all");
            const gopayConfig = getGoPayConfig();
            const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId || orderNumber}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const goPayPayment = paymentResponse.data;
            if (orderNumber) {
                const paymentRef = admin.firestore().collection("payments").doc(orderNumber);
                await paymentRef.update({
                    state: goPayPayment.state,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastChecked: admin.firestore.FieldValue.serverTimestamp(),
                    gopayResponse: goPayPayment,
                });
                if (goPayPayment.state === "PAID") {
                    await activateUserPlan(orderNumber);
                }
            }
            res.status(200).json({
                success: true,
                payment: {
                    id: goPayPayment.id,
                    orderNumber: goPayPayment.order_number,
                    state: goPayPayment.state,
                    amount: goPayPayment.amount ? goPayPayment.amount / 100 : 0,
                    currency: goPayPayment.currency,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                error: "Failed to check payment",
                message: error === null || error === void 0 ? void 0 : error.message,
                details: ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || undefined,
            });
        }
    });
});
/**
 * Endpoint pro notifikace od GoPay
 */
exports.gopayNotification = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        try {
            const notification = req.body;
            functions.logger.info("GoPay notification received", { notification });
            if (!(notification === null || notification === void 0 ? void 0 : notification.id)) {
                res.status(400).json({ error: "Missing payment id in notification" });
                return;
            }
            const paymentId = notification.id;
            const accessToken = await getGoPayAccessToken("payment-all");
            const gopayConfig = getGoPayConfig();
            const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const goPayPayment = paymentResponse.data;
            const paymentsSnapshot = await admin
                .firestore()
                .collection("payments")
                .where("gopayId", "==", paymentId)
                .limit(1)
                .get();
            if (!paymentsSnapshot.empty) {
                const paymentDoc = paymentsSnapshot.docs[0];
                const orderNumber = paymentDoc.id;
                await paymentDoc.ref.update({
                    state: goPayPayment.state,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    notificationReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    gopayResponse: goPayPayment,
                });
                if (goPayPayment.state === "PAID") {
                    await activateUserPlan(orderNumber);
                }
            }
            res.status(200).send("OK");
        }
        catch (error) {
            functions.logger.error("GoPay notification error", { error: error === null || error === void 0 ? void 0 : error.message });
            res.status(200).send("OK");
        }
    });
});
/**
 * Pomocný endpoint pro payment return (redirect z GoPay)
 */
exports.paymentReturn = functions.https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c;
        try {
            const paymentId = req.query.idPaymentSession || "";
            const state = req.query.state || "";
            if (paymentId) {
                const accessToken = await getGoPayAccessToken("payment-all");
                const gopayConfig = getGoPayConfig();
                try {
                    const paymentResponse = await axios_1.default.get(`${gopayConfig.apiUrl}/payments/payment/${paymentId}`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    const goPayPayment = paymentResponse.data;
                    const paymentsSnapshot = await admin
                        .firestore()
                        .collection("payments")
                        .where("gopayId", "==", parseInt(paymentId, 10))
                        .limit(1)
                        .get();
                    if (!paymentsSnapshot.empty) {
                        const paymentDoc = paymentsSnapshot.docs[0];
                        const orderNumber = paymentDoc.id;
                        await paymentDoc.ref.update({
                            state: goPayPayment.state,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            gopayResponse: goPayPayment,
                        });
                        if (goPayPayment.state === "PAID") {
                            await activateUserPlan(orderNumber);
                        }
                        const frontendUrl = ((_a = functions.config().frontend) === null || _a === void 0 ? void 0 : _a.url) || "https://bulldogo.cz";
                        const returnPath = `/packages.html?payment=${goPayPayment.state}&orderNumber=${orderNumber}&paymentId=${paymentId}`;
                        res.redirect(`${frontendUrl}${returnPath}`);
                        return;
                    }
                }
                catch (e) {
                    // ignore – fallback redirect below
                }
            }
            const frontendUrl = ((_b = functions.config().frontend) === null || _b === void 0 ? void 0 : _b.url) || "https://bulldogo.cz";
            res.redirect(`${frontendUrl}/packages.html?payment=${state || "unknown"}`);
        }
        catch (error) {
            const frontendUrl = ((_c = functions.config().frontend) === null || _c === void 0 ? void 0 : _c.url) || "https://bulldogo.cz";
            res.redirect(`${frontendUrl}/packages.html?payment=error`);
        }
    });
});
/**
 * Balíček expiroval => inzeráty se přesunou na 1 měsíc do "Moje inzeráty" (status=inactive, reason=plan_expired),
 * poté se trvale smažou (včetně reviews). Pro ostatní uživatele nejsou viditelné.
 */
const PLAN_EXPIRED_DELETE_DAYS = 30;
exports.enforceExpiredPlanAds = functions
    .region("europe-west1")
    .pubsub.schedule("*/5 * * * *") // každých 5 minut – minimalizuje okno viditelnosti
    .timeZone("Europe/Prague")
    .onRun(async () => {
    const db = admin.firestore();
    const nowDate = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(nowDate);
    const deleteCutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PLAN_EXPIRED_DELETE_DAYS * 24 * MILLIS_IN_DAY);
    let processed = 0;
    let inactivated = 0;
    let deleted = 0;
    // SPOLEHLIVÝ PŘÍSTUP: Projít všechny uživatele a zkontrolovat jejich plán
    functions.logger.info("🔍 Checking all users for expired plans...");
    const usersSnap = await db.collection("users").get();
    functions.logger.info(`📋 Found ${usersSnap.size} users to check`);
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        // Načíst profil
        let profile = null;
        try {
            const profileDoc = await db.doc(`users/${userId}/profile/profile`).get();
            profile = profileDoc.exists ? profileDoc.data() : null;
        }
        catch (e) {
            continue;
        }
        // Zkontrolovat, zda má aktivní plán
        const hasActivePlan = isPlanActive(profile, nowDate);
        if (hasActivePlan) {
            // Má aktivní plán - přeskočit
            continue;
        }
        // Najít aktivní inzeráty tohoto uživatele
        const adsSnap = await db.collection(`users/${userId}/inzeraty`).where("status", "==", "active").get();
        if (adsSnap.empty) {
            continue;
        }
        functions.logger.info(`🚫 User ${userId} has no active plan, deactivating ${adsSnap.size} ads`);
        // Nemá aktivní plán - deaktivovat všechny jeho aktivní inzeráty
        let batch = db.batch();
        let ops = 0;
        for (const adDoc of adsSnap.docs) {
            batch.update(adDoc.ref, {
                status: "inactive",
                inactiveReason: "plan_expired",
                inactiveAt: nowTs,
                updatedAt: nowTs,
            });
            ops++;
            inactivated++;
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0) {
            await batch.commit();
        }
        // Aktualizovat profil
        const profileRef = db.doc(`users/${userId}/profile/profile`);
        const planEnd = profile ? toDateMaybe(profile.planPeriodEnd) : null;
        const existingExpiredAt = profile === null || profile === void 0 ? void 0 : profile.planExpiredAt;
        const expiredAt = existingExpiredAt ? existingExpiredAt : (planEnd ? admin.firestore.Timestamp.fromDate(planEnd) : nowTs);
        await profileRef.set({
            plan: null,
            planCancelAt: null,
            planExpiredAt: expiredAt,
            planExpiredProcessedAt: nowTs,
        }, { merge: true });
        processed++;
    }
    // DRUHÁ ČÁST: Mazání starých inzerátů označených jako plan_expired (starší než 30 dní)
    functions.logger.info("🗑️ Checking for old expired ads to delete...");
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const expiredAdsSnap = await db.collection(`users/${userId}/inzeraty`)
            .where("status", "==", "inactive")
            .where("inactiveReason", "==", "plan_expired")
            .get();
        for (const adDoc of expiredAdsSnap.docs) {
            const ad = adDoc.data();
            const inactiveAtDate = toDateMaybe(ad.inactiveAt);
            const inactiveAt = inactiveAtDate ? admin.firestore.Timestamp.fromDate(inactiveAtDate) : null;
            // Mazat jen ty starší než 30 dní
            if (inactiveAt && inactiveAt.toMillis() <= deleteCutoff.toMillis()) {
                try {
                    await deleteAdReviewsAndDoc(adDoc.ref);
                    deleted++;
                }
                catch (e) {
                    functions.logger.warn("Failed to delete expired ad", { adId: adDoc.id, error: e === null || e === void 0 ? void 0 : e.message });
                }
            }
        }
    }
    // 3) Pokud uživatel obnovil balíček mimo GoPay flow (např. Stripe extension),
    // vyčisti profily, které mají planExpiredAt, ale plán už je zase aktivní.
    try {
        const markedSnap = await db.collectionGroup("profile").where("planExpiredAt", "!=", null).get();
        for (const profDoc of markedSnap.docs) {
            const uid = getUidFromProfileDocRef(profDoc.ref);
            if (!uid)
                continue;
            const profile = profDoc.data();
            if (isPlanActive(profile, nowDate)) {
                await clearPlanExpiredMarkersForUser(uid);
            }
        }
    }
    catch (e) {
        functions.logger.debug("Skipped renewal markers cleanup", { error: e === null || e === void 0 ? void 0 : e.message });
    }
    functions.logger.info("✅ enforceExpiredPlanAds finished", { processed, inactivated, deleted });
    return null;
});
/**
 * Manuální HTTP endpoint pro okamžitou kontrolu a deaktivaci inzerátů bez aktivního plánu.
 * Volat: GET /forceCheckExpiredPlans
 */
exports.forceCheckExpiredPlans = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            const db = admin.firestore();
            const nowDate = new Date();
            const nowTs = admin.firestore.Timestamp.fromDate(nowDate);
            let checked = 0;
            let deactivated = 0;
            const details = [];
            // Projít všechny uživatele
            const usersSnap = await db.collection("users").get();
            for (const userDoc of usersSnap.docs) {
                const userId = userDoc.id;
                checked++;
                // Načíst profil
                const profileDoc = await db.doc(`users/${userId}/profile/profile`).get();
                const profile = profileDoc.exists ? profileDoc.data() : null;
                const hasActivePlan = isPlanActive(profile, nowDate);
                // Načíst aktivní inzeráty tohoto uživatele
                const adsSnap = await db.collection(`users/${userId}/inzeraty`).where("status", "==", "active").get();
                const userDetail = {
                    userId,
                    activeAdsCount: adsSnap.size,
                    hasActivePlan,
                    profileExists: profileDoc.exists,
                    plan: (profile === null || profile === void 0 ? void 0 : profile.plan) || null,
                    planPeriodEnd: (profile === null || profile === void 0 ? void 0 : profile.planPeriodEnd) ? (_a = toDateMaybe(profile.planPeriodEnd)) === null || _a === void 0 ? void 0 : _a.toISOString() : null,
                };
                if (!hasActivePlan && adsSnap.size > 0) {
                    // Deaktivovat všechny aktivní inzeráty
                    let batch = db.batch();
                    let ops = 0;
                    for (const adDoc of adsSnap.docs) {
                        batch.update(adDoc.ref, {
                            status: "inactive",
                            inactiveReason: "plan_expired",
                            inactiveAt: nowTs,
                            updatedAt: nowTs,
                        });
                        ops++;
                        deactivated++;
                        if (ops >= 450) {
                            await batch.commit();
                            batch = db.batch();
                            ops = 0;
                        }
                    }
                    if (ops > 0) {
                        await batch.commit();
                    }
                    userDetail.action = `DEACTIVATED ${adsSnap.size} ads`;
                }
                else if (hasActivePlan) {
                    userDetail.action = "SKIPPED (has active plan)";
                }
                else {
                    userDetail.action = "SKIPPED (no active ads)";
                }
                details.push(userDetail);
            }
            res.json({
                success: true,
                message: `Zkontrolováno ${checked} uživatelů, deaktivováno ${deactivated} inzerátů`,
                usersChecked: checked,
                adsDeactivated: deactivated,
                details,
            });
        }
        catch (error) {
            functions.logger.error("Error in forceCheckExpiredPlans", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
/**
 * Trigger: Když se změní profil uživatele a plan se změní na null/prázdný,
 * okamžitě pozastavit všechny jeho inzeráty.
 */
exports.onPlanCancelled = functions
    .region("europe-west1")
    .firestore.document("users/{userId}/profile/profile")
    .onUpdate(async (change, context) => {
    const userId = context.params.userId;
    const before = change.before.data();
    const after = change.after.data();
    const planBefore = ((before === null || before === void 0 ? void 0 : before.plan) || "").toString();
    const planAfter = ((after === null || after === void 0 ? void 0 : after.plan) || "").toString();
    // Kontrola: měl plán a teď nemá (zrušení předplatného)
    const hadActivePlan = planBefore === "hobby" || planBefore === "business";
    const hasActivePlan = planAfter === "hobby" || planAfter === "business";
    const db = admin.firestore();
    // PŘÍPAD 1: Zrušení předplatného (měl plán, teď nemá)
    if (hadActivePlan && !hasActivePlan) {
        functions.logger.info("🚫 Plan cancelled for user, deactivating ads", { userId, planBefore, planAfter });
        const nowTs = admin.firestore.FieldValue.serverTimestamp();
        // Pozastavit všechny aktivní inzeráty uživatele
        const adsSnap = await db.collection(`users/${userId}/inzeraty`).where("status", "==", "active").get();
        if (adsSnap.empty) {
            functions.logger.info("No active ads to deactivate for user", { userId });
            return null;
        }
        let batch = db.batch();
        let ops = 0;
        let deactivated = 0;
        for (const adDoc of adsSnap.docs) {
            batch.update(adDoc.ref, {
                status: "inactive",
                inactiveReason: "plan_expired",
                inactiveAt: nowTs,
                updatedAt: nowTs,
            });
            ops++;
            deactivated++;
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0) {
            await batch.commit();
        }
        functions.logger.info("✅ Deactivated ads due to plan cancellation", { userId, deactivated });
        return null;
    }
    // PŘÍPAD 2: Obnovení předplatného (neměl plán, teď má)
    if (!hadActivePlan && hasActivePlan) {
        functions.logger.info("✅ Plan renewed for user, clearing expired markers", { userId, planBefore, planAfter });
        // Vyčistit inactiveReason z inzerátů, které byly pozastaveny kvůli vypršení předplatného
        const expiredAdsSnap = await db.collection(`users/${userId}/inzeraty`).where("inactiveReason", "==", "plan_expired").get();
        if (expiredAdsSnap.empty) {
            functions.logger.info("No expired ads to clean for user", { userId });
            return null;
        }
        let batch = db.batch();
        let ops = 0;
        let cleaned = 0;
        for (const adDoc of expiredAdsSnap.docs) {
            batch.update(adDoc.ref, {
                inactiveReason: admin.firestore.FieldValue.delete(),
                inactiveAt: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            ops++;
            cleaned++;
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0) {
            await batch.commit();
        }
        // Vyčistit planExpiredAt z profilu
        await change.after.ref.set({
            planExpiredAt: admin.firestore.FieldValue.delete(),
            planExpiredProcessedAt: admin.firestore.FieldValue.delete(),
        }, { merge: true });
        functions.logger.info("✅ Cleaned expired markers for renewed user", { userId, cleaned });
        return null;
    }
    return null;
});
// ===============================================
// SMTP Email konfigurace pro Hostinger
// ===============================================
const smtpTransporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
        user: "info@bulldogo.cz",
        pass: "Fotbal1997.",
    },
});
/**
 * Univerzální šablona pro všechny emaily
 */
function generateEmailTemplate(options) {
    const { title, userName, content, buttonText, buttonUrl, footerText } = options;
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title} - Bulldogo.cz</title>
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #f5f5f5 !important; }
    .email-body { background-color: #f5f5f5 !important; }
    .email-container { background-color: #f5f5f5 !important; }
    .email-card { background-color: #ffffff !important; }
    .email-text { color: #1a1a1a !important; }
    .email-text-strong { color: #000000 !important; }
  </style>
  <![endif]-->
  <style>
    /* Výchozí světlý režim - lepší čitelnost */
    .email-body { background-color: #f5f5f5 !important; }
    .email-container { background-color: #f5f5f5 !important; }
    .email-card { background-color: #ffffff !important; border-color: #e0e0e0 !important; }
    .email-text { color: #1a1a1a !important; }
    .email-text-strong { color: #000000 !important; }
    .email-footer { color: #4a4a4a !important; }
    .email-footer-link { color: #f77c00 !important; }
    .email-footer-muted { color: #6b7280 !important; }
    h1, h2, h3, h4, h5, h6 { color: #000000 !important; }
    p { color: #1a1a1a !important; }
    a { color: #f77c00 !important; }
    strong { color: #000000 !important; }
    em { color: #1a1a1a !important; }
    
    /* Světlý režim - explicitní světlý režim */
    @media (prefers-color-scheme: light) {
      .email-body { background-color: #f5f5f5 !important; }
      .email-container { background-color: #f5f5f5 !important; }
      .email-card { background-color: #ffffff !important; border-color: #e0e0e0 !important; }
      .email-text { color: #1a1a1a !important; }
      .email-text-strong { color: #000000 !important; }
      .email-footer { color: #4a4a4a !important; }
      .email-footer-link { color: #f77c00 !important; }
      .email-footer-muted { color: #6b7280 !important; }
      h1, h2, h3, h4, h5, h6 { color: #000000 !important; }
      p { color: #1a1a1a !important; }
      a { color: #f77c00 !important; }
      strong { color: #000000 !important; }
      em { color: #1a1a1a !important; }
    }
    
    /* Tmavý režim - tmavé pozadí se světlým textem s vysokým kontrastem */
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #0f0f0f !important; }
      .email-container { background-color: #0f0f0f !important; }
      .email-card { background-color: #1f1f1f !important; border-color: #404040 !important; }
      .email-text { color: #f0f0f0 !important; }
      .email-text-strong { color: #ffffff !important; }
      .email-footer { color: #d0d0d0 !important; }
      .email-footer-link { color: #ff9500 !important; }
      .email-footer-muted { color: #a0a0a0 !important; }
      h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }
      p { color: #f0f0f0 !important; }
      a { color: #ff9500 !important; }
      strong { color: #ffffff !important; }
      em { color: #f0f0f0 !important; }
      ul, ol, li { color: #f0f0f0 !important; }
      /* Přepsat všechny inline barvy v tmavém režimu */
      *[style*="color: #111827"],
      *[style*="color:#111827"],
      *[style*="color: #1a1a2e"],
      *[style*="color:#1a1a2e"],
      *[style*="color: #1a1a1a"],
      *[style*="color:#1a1a1a"],
      *[style*="color: #374151"],
      *[style*="color:#374151"],
      *[style*="color: #6b7280"],
      *[style*="color:#6b7280"],
      *[style*="color: #9ca3af"],
      *[style*="color:#9ca3af"],
      *[style*="color: #718096"],
      *[style*="color:#718096"] {
        color: #f0f0f0 !important;
      }
      strong[style*="color"],
      .text-strong[style*="color"],
      h1[style*="color"],
      h2[style*="color"],
      h3[style*="color"],
      h4[style*="color"],
      h5[style*="color"],
      h6[style*="color"] {
        color: #ffffff !important;
      }
      /* Alert boxy v tmavém režimu - světlé barvy */
      .alert-warning[style*="background: #fffbeb"],
      .alert-warning[style*="background:#fffbeb"] {
        background-color: #3d3021 !important;
        border-left-color: #f59e0b !important;
      }
      .alert-warning[style*="background: #fff8eb"],
      .alert-warning[style*="background:#fff8eb"] {
        background-color: #3d3021 !important;
        border-left-color: #f59e0b !important;
      }
      .alert-warning-title[style*="color: #92400e"],
      .alert-warning-title[style*="color:#92400e"],
      .alert-warning-title[style*="color: #b45309"],
      .alert-warning-title[style*="color:#b45309"],
      .alert-warning-text[style*="color: #78350f"],
      .alert-warning-text[style*="color:#78350f"] {
        color: #fbbf24 !important;
      }
      .alert-success[style*="background: #f0fdf4"],
      .alert-success[style*="background:#f0fdf4"] {
        background-color: #1a3d2e !important;
        border-left-color: #22c55e !important;
      }
      .alert-success-title[style*="color: #166534"],
      .alert-success-title[style*="color:#166534"],
      .alert-success-text[style*="color: #15803d"],
      .alert-success-text[style*="color:#15803d"] {
        color: #86efac !important;
      }
      .alert-danger[style*="background: #fef2f2"],
      .alert-danger[style*="background:#fef2f2"] {
        background-color: #3d1f1f !important;
        border-left-color: #ef4444 !important;
      }
      .alert-danger-text[style*="color: #991b1b"],
      .alert-danger-text[style*="color:#991b1b"] {
        color: #fca5a5 !important;
      }
      .alert-info[style*="background: #f8f9fa"],
      .alert-info[style*="background:#f8f9fa"] {
        background-color: #2d2d2d !important;
        border-left-color: #f77c00 !important;
      }
      .alert-info-text[style*="color: #374151"],
      .alert-info-text[style*="color:#374151"] {
        color: #d1d5db !important;
      }
      /* Alert boxy - zelené (success) */
      .alert-success { 
        background-color: #1a3d2e !important; 
        border-left-color: #22c55e !important; 
      }
      .alert-success-text { 
        color: #86efac !important; 
      }
      .alert-success-title { 
        color: #86efac !important; 
      }
      /* Alert boxy - žluté/oranžové (warning) */
      .alert-warning { 
        background-color: #3d3021 !important; 
        border-left-color: #f59e0b !important; 
      }
      .alert-warning-text { 
        color: #fbbf24 !important; 
      }
      .alert-warning-title { 
        color: #fbbf24 !important; 
      }
      /* Alert boxy - červené (danger) */
      .alert-danger { 
        background-color: #3d1f1f !important; 
        border-left-color: #ef4444 !important; 
      }
      .alert-danger-text { 
        color: #fca5a5 !important; 
      }
      /* Alert boxy - modré/neutrální */
      .alert-info { 
        background-color: #2d2d2d !important; 
        border-left-color: #6b7280 !important; 
      }
      .alert-info-text { 
        color: #d1d5db !important; 
      }
    /* Obecné texty - vysoký kontrast pro tmavý režim */
    .text-primary { 
      color: #f0f0f0 !important; 
    }
    .text-strong { 
      color: #ffffff !important; 
      font-weight: 700 !important;
    }
    .text-secondary { 
      color: #d0d0d0 !important; 
    }
    /* Přepsat inline barvy pro tmavý režim */
    .text-primary[style*="color"],
    .text-strong[style*="color"] {
      color: #f0f0f0 !important;
    }
    strong.text-strong[style*="color"] {
      color: #ffffff !important;
    }
    }
    /* Outlook dark mode support - vysoký kontrast */
    [data-ogsc] .email-body { background-color: #0f0f0f !important; }
    [data-ogsc] .email-container { background-color: #0f0f0f !important; }
    [data-ogsc] .email-card { background-color: #1f1f1f !important; border-color: #404040 !important; }
    [data-ogsc] .email-text { color: #f0f0f0 !important; }
    [data-ogsc] .email-text-strong { color: #ffffff !important; }
    [data-ogsc] .email-footer { color: #d0d0d0 !important; }
    [data-ogsc] .email-footer-link { color: #ff9500 !important; }
    [data-ogsc] .email-footer-muted { color: #a0a0a0 !important; }
    [data-ogsc] h1, [data-ogsc] h2, [data-ogsc] h3, [data-ogsc] h4, [data-ogsc] h5, [data-ogsc] h6 { color: #ffffff !important; }
    [data-ogsc] p { color: #f0f0f0 !important; }
    [data-ogsc] a { color: #ff9500 !important; }
    [data-ogsc] strong { color: #ffffff !important; }
    [data-ogsc] em { color: #f0f0f0 !important; }
    [data-ogsc] .alert-success { 
      background-color: #1a3d2e !important; 
      border-left-color: #22c55e !important; 
    }
    [data-ogsc] .alert-success-text { 
      color: #86efac !important; 
    }
    [data-ogsc] .alert-success-title { 
      color: #86efac !important; 
    }
    [data-ogsc] .alert-warning { 
      background-color: #3d3021 !important; 
      border-left-color: #f59e0b !important; 
    }
    [data-ogsc] .alert-warning-text { 
      color: #fbbf24 !important; 
    }
    [data-ogsc] .alert-warning-title { 
      color: #fbbf24 !important; 
    }
    [data-ogsc] .alert-danger { 
      background-color: #3d1f1f !important; 
      border-left-color: #ef4444 !important; 
    }
    [data-ogsc] .alert-danger-text { 
      color: #fca5a5 !important; 
    }
    [data-ogsc] .alert-info { 
      background-color: #2d2d2d !important; 
      border-left-color: #6b7280 !important; 
    }
    [data-ogsc] .alert-info-text { 
      color: #d1d5db !important; 
    }
    [data-ogsc] .text-primary { 
      color: #f0f0f0 !important; 
    }
    [data-ogsc] .text-strong { 
      color: #ffffff !important; 
      font-weight: 700 !important;
    }
    [data-ogsc] .text-secondary { 
      color: #d0d0d0 !important; 
    }
    [data-ogsc] h1, [data-ogsc] h2, [data-ogsc] h3, [data-ogsc] h4, [data-ogsc] h5, [data-ogsc] h6 { color: #ffffff !important; }
    [data-ogsc] p { color: #f0f0f0 !important; }
    [data-ogsc] a { color: #ff9500 !important; }
    [data-ogsc] strong { color: #ffffff !important; }
    [data-ogsc] em { color: #f0f0f0 !important; }
    [data-ogsc] ul, [data-ogsc] ol, [data-ogsc] li { color: #f0f0f0 !important; }
    /* Přepsat všechny inline barvy v tmavém režimu pro Outlook */
    [data-ogsc] *[style*="color: #111827"],
    [data-ogsc] *[style*="color:#111827"],
    [data-ogsc] *[style*="color: #1a1a2e"],
    [data-ogsc] *[style*="color:#1a1a2e"],
    [data-ogsc] *[style*="color: #1a1a1a"],
    [data-ogsc] *[style*="color:#1a1a1a"],
    [data-ogsc] *[style*="color: #374151"],
    [data-ogsc] *[style*="color:#374151"],
    [data-ogsc] *[style*="color: #6b7280"],
    [data-ogsc] *[style*="color:#6b7280"],
    [data-ogsc] *[style*="color: #9ca3af"],
    [data-ogsc] *[style*="color:#9ca3af"],
    [data-ogsc] *[style*="color: #718096"],
    [data-ogsc] *[style*="color:#718096"] {
      color: #f0f0f0 !important;
    }
    [data-ogsc] strong[style*="color"],
    [data-ogsc] .text-strong[style*="color"],
    [data-ogsc] h1[style*="color"],
    [data-ogsc] h2[style*="color"],
    [data-ogsc] h3[style*="color"],
    [data-ogsc] h4[style*="color"],
    [data-ogsc] h5[style*="color"],
    [data-ogsc] h6[style*="color"] {
      color: #ffffff !important;
    }
    /* Alert boxy v tmavém režimu pro Outlook */
    [data-ogsc] .alert-warning[style*="background: #fffbeb"],
    [data-ogsc] .alert-warning[style*="background:#fffbeb"],
    [data-ogsc] .alert-warning[style*="background: #fff8eb"],
    [data-ogsc] .alert-warning[style*="background:#fff8eb"] {
      background-color: #3d3021 !important;
      border-left-color: #f59e0b !important;
    }
    [data-ogsc] .alert-warning-title[style*="color: #92400e"],
    [data-ogsc] .alert-warning-title[style*="color:#92400e"],
    [data-ogsc] .alert-warning-title[style*="color: #b45309"],
    [data-ogsc] .alert-warning-title[style*="color:#b45309"],
    [data-ogsc] .alert-warning-text[style*="color: #78350f"],
    [data-ogsc] .alert-warning-text[style*="color:#78350f"] {
      color: #fbbf24 !important;
    }
    [data-ogsc] .alert-success[style*="background: #f0fdf4"],
    [data-ogsc] .alert-success[style*="background:#f0fdf4"] {
      background-color: #1a3d2e !important;
      border-left-color: #22c55e !important;
    }
    [data-ogsc] .alert-success-title[style*="color: #166534"],
    [data-ogsc] .alert-success-title[style*="color:#166534"],
    [data-ogsc] .alert-success-text[style*="color: #15803d"],
    [data-ogsc] .alert-success-text[style*="color:#15803d"] {
      color: #86efac !important;
    }
    [data-ogsc] .alert-danger[style*="background: #fef2f2"],
    [data-ogsc] .alert-danger[style*="background:#fef2f2"] {
      background-color: #3d1f1f !important;
      border-left-color: #ef4444 !important;
    }
    [data-ogsc] .alert-danger-text[style*="color: #991b1b"],
    [data-ogsc] .alert-danger-text[style*="color:#991b1b"] {
      color: #fca5a5 !important;
    }
    [data-ogsc] .alert-info[style*="background: #f8f9fa"],
    [data-ogsc] .alert-info[style*="background:#f8f9fa"] {
      background-color: #2d2d2d !important;
      border-left-color: #f77c00 !important;
    }
    [data-ogsc] .alert-info-text[style*="color: #374151"],
    [data-ogsc] .alert-info-text[style*="color:#374151"] {
      color: #d1d5db !important;
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="background: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(247, 124, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      B<span style="background: linear-gradient(90deg, #ffffff 0%, #ffd700 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">ULLDOGO</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Hlavní karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" style="background: #ffffff; border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.15); overflow: hidden; border: 1px solid #e0e0e0;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${title}</h1>
                  </td>
                </tr>
                
                <!-- Obsah -->
                <tr>
                  <td style="padding: 40px 30px; background-color: #ffffff;">
                    <p class="email-text" style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                      Ahoj <strong class="email-text-strong" style="color: #000000; font-weight: 700;">${userName}</strong>,
                    </p>
                    <div class="email-text" style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
                      ${content}
                    </div>
                    ${buttonText && buttonUrl ? `
                    <!-- Tlačítko -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-top: 30px;">
                          <a href="${buttonUrl}" style="display: inline-block; background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 16px rgba(247, 124, 0, 0.3);">
                            ${buttonText}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 30px;">
              ${footerText ? `
              <p class="email-footer" style="margin: 0 0 10px 0; font-size: 13px; color: #4a4a4a; line-height: 1.6;">
                ${footerText}
              </p>
              ` : ''}
              <p class="email-footer" style="margin: 0; font-size: 13px; color: #4a4a4a;">
                <a href="https://bulldogo.cz" class="email-footer-link" style="color: #f77c00; text-decoration: none; font-weight: 600;">bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="mailto:support@bulldogo.cz" class="email-footer-link" style="color: #f77c00; text-decoration: none; font-weight: 600;">support@bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="tel:+420605121023" class="email-footer-link" style="color: #f77c00; text-decoration: none; font-weight: 600;">+420 605 121 023</a>
              </p>
              <p class="email-footer-muted" style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
                © 2026 BULLDOGO. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
/**
 * Načte jméno uživatele z Firestore profilu
 */
async function getUserNameFromProfile(uid) {
    try {
        const db = admin.firestore();
        const profileDoc = await db.doc(`users/${uid}/profile/profile`).get();
        if (profileDoc.exists) {
            const data = profileDoc.data();
            // Priorita: firstName, pak name, pak companyName
            if (data.firstName) {
                return data.firstName;
            }
            if (data.name && data.name !== "Uživatel" && data.name !== "Firma") {
                // Vezmi jen první jméno pokud je celé jméno
                const firstName = data.name.split(" ")[0];
                return firstName;
            }
            if (data.companyName) {
                return data.companyName;
            }
        }
        return "uživateli";
    }
    catch (error) {
        return "uživateli";
    }
}
/**
 * Generuje HTML šablonu uvítacího emailu
 */
function generateWelcomeEmailHTML(userName) {
    const content = `
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
      <strong>Děkujeme za registraci</strong> na portálu Bulldogo.cz!
    </p>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
      Jsme rádi, že jste se stali součástí naší komunity. Nyní můžete využívat všechny výhody našeho portálu – vytvářet inzeráty, hledat služby a spojovat se s profesionály po celé České republice.
    </p>
    
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <p style="margin: 0 0 15px 0; font-size: 15px; color: #166534; font-weight: 600;">Co vás čeká?</p>
      <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 1.8;">
        <li>Snadné vytváření inzerátů</li>
        <li>Ověření firemních profilů</li>
        <li>Integrovaný chat se zákazníky</li>
        <li>Systém hodnocení a recenzí</li>
      </ul>
    </div>
  `;
    return generateEmailTemplate({
        title: "🎉 Vítejte na Bulldogo.cz",
        userName,
        content,
        buttonText: "Prohlédnout služby",
        buttonUrl: "https://bulldogo.cz/services.html"
    });
}
// Stará funkce - odstraněna
function generateWelcomeEmailHTML_OLD(userName) {
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Vítejte na Bulldogo.cz</title>
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #ffffff !important; }
  </style>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-container { background-color: #1a1a1a !important; }
      .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-text-light { color: #b0b0b0 !important; }
      .email-text-dark { color: #ffffff !important; }
      .email-title { color: #ffffff !important; }
      .email-border { border-color: #404040 !important; }
      .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    }
    [data-ogsc] .email-body { background-color: #1a1a1a !important; }
    [data-ogsc] .email-container { background-color: #1a1a1a !important; }
    [data-ogsc] .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
    [data-ogsc] .email-text { color: #e5e5e5 !important; }
    [data-ogsc] .email-text-light { color: #b0b0b0 !important; }
    [data-ogsc] .email-text-dark { color: #ffffff !important; }
    [data-ogsc] .email-title { color: #ffffff !important; }
    [data-ogsc] .email-border { border-color: #404040 !important; }
    [data-ogsc] .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff; background: #ffffff; min-height: 100vh;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="background-color: #ffffff; background: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Hlavní kontejner -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo sekce -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(255, 106, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      B<span style="background: linear-gradient(90deg, #ffffff 0%, #ffd700 100%); -webkit-background-clip: text; background-clip: text;">ULLDOGO</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Hlavní karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" style="background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1); overflow: hidden;">
                
                <!-- Oranžový header pruh -->
                <tr>
                  <td style="background: linear-gradient(90deg, #ff6a00 0%, #ffa62b 50%, #fcd34d 100%); height: 8px;"></td>
                </tr>
                
                <!-- Ikona obálky -->
                <tr>
                  <td align="center" style="padding: 40px 0 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="email-bg-light" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 50%; width: 100px; height: 100px; text-align: center; line-height: 100px; box-shadow: 0 10px 30px rgba(255, 166, 43, 0.3);">
                          <span style="font-size: 50px;">🎉</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Pozdrav -->
                <tr>
                  <td align="center" style="padding: 0 40px 20px 40px;">
                    <h1 class="email-title" style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a2e; line-height: 1.3;">
                      Ahoj, ${userName}! 👋
                    </h1>
                  </td>
                </tr>
                
                <!-- Hlavní text -->
                <tr>
                  <td align="center" style="padding: 0 40px 30px 40px;">
                    <p class="email-text-dark" style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.7; color: #1a1a2e;">
                      <strong style="color: #ff6a00;">Děkujeme za registraci</strong> na portálu <strong class="email-text-dark" style="color: #1a1a2e;">Bulldogo.cz</strong>!
                    </p>
                    <p class="email-text" style="margin: 0; font-size: 16px; line-height: 1.7; color: #2d3748;">
                      Jsme rádi, že jste se stali součástí naší komunity. Nyní můžete využívat všechny výhody našeho portálu – <strong class="email-text-dark" style="color: #1a1a2e;">vytvářet inzeráty</strong>, <strong class="email-text-dark" style="color: #1a1a2e;">hledat služby</strong> a <strong class="email-text-dark" style="color: #1a1a2e;">spojovat se s profesionály</strong> po celé České republice.
                    </p>
                  </td>
                </tr>
                
                <!-- Výhody sekce -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-bg-light email-border" style="background: linear-gradient(135deg, #fff8eb 0%, #fff3e0 100%); border-radius: 16px; border: 1px solid #ffe0b2;">
                      <tr>
                        <td style="padding: 25px;">
                          <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: 700; color: #ff6a00; text-transform: uppercase; letter-spacing: 1px;">
                            Co vás čeká?
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #22c55e; font-size: 18px;">✓</span>
                                <span class="email-text-dark" style="margin-left: 10px; color: #1a1a2e; font-size: 15px; font-weight: 500;">Snadné vytváření inzerátů</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #22c55e; font-size: 18px;">✓</span>
                                <span class="email-text-dark" style="margin-left: 10px; color: #1a1a2e; font-size: 15px; font-weight: 500;">Ověření firemních profilu</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #22c55e; font-size: 18px;">✓</span>
                                <span class="email-text-dark" style="margin-left: 10px; color: #1a1a2e; font-size: 15px; font-weight: 500;">Integrovaný chat se zákazníky</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="color: #22c55e; font-size: 18px;">✓</span>
                                <span class="email-text-dark" style="margin-left: 10px; color: #1a1a2e; font-size: 15px; font-weight: 500;">Systém hodnocení a recenzí</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- CTA tlačítko -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ff6a00 0%, #ffa62b 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(255, 106, 0, 0.35);">
                          <a href="https://bulldogo.cz/services.html" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px;">
                            PROHLÉDNOUT SLUŽBY →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px;">
              <p class="email-text" style="margin: 0 0 10px 0; font-size: 14px; color: #374151; font-weight: 500;">
                „Služby jednoduše. Pro každého."
              </p>
              <p class="email-text-dark" style="margin: 0 0 20px 0; font-size: 13px; color: #1a1a2e;">
                <a href="https://bulldogo.cz" style="color: #ff6a00; text-decoration: none; font-weight: 600;">bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="mailto:support@bulldogo.cz" style="color: #ff6a00; text-decoration: none; font-weight: 600;">support@bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="tel:+420605121023" style="color: #ff6a00; text-decoration: none; font-weight: 600;">+420 605 121 023</a>
              </p>
              <p class="email-text-light" style="margin: 0; font-size: 12px; color: #4b5563;">
                © 2026 BULLDOGO. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Mapování názvů polí na české popisky
 */
const fieldLabels = {
    name: "Jméno",
    email: "E-mail",
    phone: "Telefon",
    passwordChangedAt: "Heslo",
    city: "Město",
    bio: "O mně",
    businessName: "Název firmy",
    businessType: "Typ podnikání",
    businessAddress: "Adresa firmy",
    businessDescription: "Popis firmy",
    companyName: "Název společnosti",
    ico: "IČO",
    dic: "DIČ",
    address: "Adresa",
    emailNotifications: "E-mailová upozornění",
    smsNotifications: "SMS upozornění",
    marketingEmails: "Marketingové e-maily",
};
/**
 * Pole, která se mají ignorovat při porovnání změn
 */
const ignoredFields = [
    "updatedAt",
    "createdAt",
    "rating",
    "totalReviews",
    "ratingBreakdown",
    "recentReviews",
    "totalAds",
    "activeAds",
    "totalViews",
    "totalContacts",
    "balance",
    "plan",
    "planName",
    "planUpdatedAt",
    "planPeriodStart",
    "planPeriodEnd",
    "planDurationDays",
    "planCancelAt",
    "planExpiredAt",
    "planExpiredProcessedAt",
    "firstName",
    "lastName",
    "birthDate",
    "photoURL",
    "avatarUrl",
    "avatar",
    "avatarUpdatedAt",
];
/**
 * Formátuje hodnotu pro zobrazení v emailu
 */
function formatValue(value) {
    if (value === null || value === undefined)
        return "—";
    if (typeof value === "boolean")
        return value ? "Ano" : "Ne";
    if (typeof value === "object") {
        // Timestamp objekty (Firestore Timestamp)
        if (value && typeof value === 'object' && 'toDate' in value) {
            return value.toDate().toLocaleString('cs-CZ');
        }
        if (value.companyName || value.ico) {
            // Je to company objekt
            const parts = [];
            if (value.companyName)
                parts.push(value.companyName);
            if (value.ico)
                parts.push(`IČO: ${value.ico}`);
            if (value.dic)
                parts.push(`DIČ: ${value.dic}`);
            if (value.address)
                parts.push(value.address);
            if (value.phone)
                parts.push(value.phone);
            return parts.join(", ") || "—";
        }
        return JSON.stringify(value);
    }
    return String(value);
}
/**
 * Porovná dva objekty a vrátí změněná pole
 */
function getChangedFields(before, after) {
    const photoRelatedFields = ["photoURL", "avatarUrl", "avatar", "avatarUpdatedAt"];
    // Zkontrolovat, zda se mění nějaké foto-related pole
    const hasPhotoChanges = photoRelatedFields.some(field => {
        const oldPhotoVal = before[field];
        const newPhotoVal = after[field];
        const oldPhotoStr = JSON.stringify(oldPhotoVal || "");
        const newPhotoStr = JSON.stringify(newPhotoVal || "");
        return oldPhotoStr !== newPhotoStr;
    });
    // Zkontrolovat, zda se mění nějaké jiné pole (kromě ignorovaných a foto-related)
    let hasOtherChanges = false;
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
        if (ignoredFields.includes(key))
            continue;
        if (photoRelatedFields.includes(key))
            continue;
        const oldVal = before[key];
        const newVal = after[key];
        const oldStr = JSON.stringify(oldVal || "");
        const newStr = JSON.stringify(newVal || "");
        if (oldStr !== newStr) {
            hasOtherChanges = true;
            break;
        }
    }
    // Pokud se mění pouze foto-related pole a žádné jiné, vrátit prázdné pole
    if (hasPhotoChanges && !hasOtherChanges) {
        return [];
    }
    // Jinak pokračovat normálně a shromáždit všechny změny
    const changes = [];
    for (const key of allKeys) {
        if (ignoredFields.includes(key))
            continue;
        if (photoRelatedFields.includes(key))
            continue; // Ignorovat foto-related pole úplně
        const oldVal = before[key];
        const newVal = after[key];
        // Porovnání hodnot - normalizace pro Timestamp objekty
        let oldNormalized = oldVal;
        let newNormalized = newVal;
        // Normalizovat Timestamp objekty
        if (oldVal && typeof oldVal === 'object' && 'toDate' in oldVal) {
            oldNormalized = oldVal.toDate().getTime();
        }
        else if (oldVal === null || oldVal === undefined || oldVal === "") {
            oldNormalized = "";
        }
        else {
            oldNormalized = String(oldVal);
        }
        if (newVal && typeof newVal === 'object' && 'toDate' in newVal) {
            newNormalized = newVal.toDate().getTime();
        }
        else if (newVal === null || newVal === undefined || newVal === "") {
            newNormalized = "";
        }
        else {
            newNormalized = String(newVal);
        }
        if (oldNormalized !== newNormalized) {
            // Speciální zpracování pro passwordChangedAt - zobrazit jako změnu hesla bez specifických údajů
            if (key === 'passwordChangedAt') {
                // Pro heslo zobrazíme jen jednoduchou zprávu bez technických údajů
                changes.push({
                    field: key,
                    label: "Heslo",
                    oldValue: null,
                    newValue: null,
                    isPasswordChange: true, // Flag pro speciální zobrazení
                });
            }
            else {
                changes.push({
                    field: key,
                    label: fieldLabels[key] || key,
                    oldValue: oldVal,
                    newValue: newVal,
                });
            }
        }
    }
    return changes;
}
/**
 * Generuje HTML šablonu emailu o změně údajů
 */
function generateProfileChangeEmailHTML(userName, changes) {
    const changesHTML = changes.map((change) => {
        // Speciální zobrazení pro změnu hesla - jen zpráva bez hodnot
        if (change.field === 'passwordChangedAt' || change.isPasswordChange) {
            return `
        <div class="alert-success" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 10px 0; border-radius: 8px;">
          <p class="alert-success-text" style="margin: 0; font-size: 14px; color: #15803d;">
            <strong class="text-strong" style="color: #15803d;">${change.label}</strong>: <span class="alert-success-title" style="color: #22c55e; font-weight: 600;">Vaše heslo bylo změněno</span>
          </p>
        </div>
      `;
        }
        // Normální zobrazení pro ostatní změny
        return `
      <div class="alert-info" style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 15px; margin: 10px 0; border-radius: 8px;">
        <p class="text-primary" style="margin: 0 0 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${change.label}</p>
        <p class="text-secondary" style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280; text-decoration: line-through;">${formatValue(change.oldValue)}</p>
        <p class="alert-success-text" style="margin: 0; font-size: 14px; color: #22c55e; font-weight: 600;">${formatValue(change.newValue)}</p>
      </div>
    `;
    }).join("");
    const content = `
    <p class="text-primary" style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
      Váš profil byl úspěšně aktualizován. Níže najdete přehled změn:
    </p>
    ${changesHTML}
    <div class="alert-warning" style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 8px;">
      <p class="alert-warning-text" style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
        <strong class="text-strong" style="color: #92400e;">⚠️ Pokud jste tyto změny neprovedli vy,</strong> okamžitě kontaktujte podporu na support@bulldogo.cz.
      </p>
    </div>
  `;
    return generateEmailTemplate({
        title: "⚙️ Změna údajů v profilu",
        userName,
        content,
        buttonText: "Zobrazit profil",
        buttonUrl: "https://bulldogo.cz/profile.html"
    });
}
// Stará funkce - odstraněna
function generateProfileChangeEmailHTML_OLD(userName, changes) {
    const changesHTML = changes.map((change) => {
        // Speciální zobrazení pro změnu hesla - jen zpráva bez hodnot
        if (change.field === 'passwordChangedAt' || change.isPasswordChange) {
            return `
    <tr>
      <td colspan="3" class="email-text-dark email-border" style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0;">
        <strong style="color: #1a1a2e;">${change.label}</strong>: <span style="color: #22c55e; font-weight: 600;">Vaše heslo bylo změněno</span>
      </td>
    </tr>
  `;
        }
        // Normální zobrazení pro ostatní změny
        return `
    <tr>
      <td class="email-text-dark email-border" style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0;">
        <strong style="color: #1a1a2e;">${change.label}</strong>
      </td>
      <td class="email-text-light email-border" style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0; color: #6b7280; text-decoration: line-through;">
        ${formatValue(change.oldValue)}
      </td>
      <td class="email-text-dark" style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0; color: #22c55e; font-weight: 600;">
        ${formatValue(change.newValue)}
      </td>
    </tr>
  `;
    }).join("");
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Změna údajů - Bulldogo.cz</title>
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #ffffff !important; }
  </style>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-container { background-color: #1a1a1a !important; }
      .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-text-light { color: #b0b0b0 !important; }
      .email-text-dark { color: #ffffff !important; }
      .email-title { color: #ffffff !important; }
      .email-border { border-color: #404040 !important; }
      .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
      .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
      .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    }
    [data-ogsc] .email-body { background-color: #1a1a1a !important; }
    [data-ogsc] .email-container { background-color: #1a1a1a !important; }
    [data-ogsc] .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
    [data-ogsc] .email-text { color: #e5e5e5 !important; }
    [data-ogsc] .email-text-light { color: #b0b0b0 !important; }
    [data-ogsc] .email-text-dark { color: #ffffff !important; }
    [data-ogsc] .email-title { color: #ffffff !important; }
    [data-ogsc] .email-border { border-color: #404040 !important; }
    [data-ogsc] .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    [data-ogsc] .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
    [data-ogsc] .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff; background: #ffffff; min-height: 100vh;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="background-color: #ffffff; background: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Hlavní kontejner -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo sekce -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(255, 106, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      B<span style="background: linear-gradient(90deg, #ffffff 0%, #ffd700 100%); -webkit-background-clip: text; background-clip: text;">ULLDOGO</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Hlavní karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                
                <!-- Oranžový header pruh -->
                <tr>
                  <td style="background: linear-gradient(90deg, #ff6a00 0%, #ffa62b 50%, #fcd34d 100%); height: 8px;"></td>
                </tr>
                
                <!-- Ikona -->
                <tr>
                  <td align="center" style="padding: 40px 0 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="email-bg-light" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 50%; width: 100px; height: 100px; text-align: center; line-height: 100px; box-shadow: 0 10px 30px rgba(255, 166, 43, 0.3);">
                          <span style="font-size: 50px;">🔐</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Pozdrav -->
                <tr>
                  <td align="center" style="padding: 0 40px 20px 40px;">
                    <h1 class="email-title" style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a2e; line-height: 1.3;">
                      Změna údajů v účtu
                    </h1>
                  </td>
                </tr>
                
                <!-- Hlavní text -->
                <tr>
                  <td align="center" style="padding: 0 40px 30px 40px;">
                    <p class="email-text" style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.7; color: #4a5568;">
                      Ahoj, <strong style="color: #ff6a00;">${userName}</strong>!
                    </p>
                    <p class="email-text" style="margin: 0; font-size: 16px; line-height: 1.7; color: #718096;">
                      Ve vašem účtu na <strong class="email-text-dark" style="color: #1a1a2e;">Bulldogo.cz</strong> byly právě provedeny následující změny:
                    </p>
                  </td>
                </tr>
                
                <!-- Tabulka změn -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-table" style="background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden;">
                      <tr class="email-table-header" style="background: linear-gradient(90deg, #f8f9fa 0%, #f3f4f6 100%);">
                        <th class="email-text-light" style="padding: 15px; text-align: left; font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Položka</th>
                        <th class="email-text-light" style="padding: 15px; text-align: left; font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Původní</th>
                        <th class="email-text-light" style="padding: 15px; text-align: left; font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Nové</th>
                      </tr>
                      ${changesHTML}
                    </table>
                  </td>
                </tr>
                
                <!-- Varování -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-bg-light email-border" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 1px solid #fecaca;">
                      <tr>
                        <td style="padding: 20px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width: 40px; vertical-align: top;">
                                <span style="font-size: 24px;">⚠️</span>
                              </td>
                              <td>
                                <p class="email-text-dark" style="margin: 0; font-size: 14px; line-height: 1.6; color: #991b1b;">
                                  <strong>Neprovedli jste tuto změnu?</strong><br>
                                  Pokud jste tyto změny neprovedli vy, okamžitě nás kontaktujte na 
                                  <a href="mailto:support@bulldogo.cz" style="color: #dc2626; font-weight: 600;">support@bulldogo.cz</a> 
                                  nebo na tel. <a href="tel:+420605121023" style="color: #dc2626; font-weight: 600;">+420 605 121 023</a>.
                                  Doporučujeme také změnit heslo k vašemu účtu.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- CTA tlačítko -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ff6a00 0%, #ffa62b 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(255, 106, 0, 0.35);">
                          <a href="https://bulldogo.cz/profile-settings.html" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px;">
                            ZKONTROLOVAT NASTAVENÍ →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px;">
              <p class="email-text" style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                „Služby jednoduše. Pro každého."
              </p>
              <p class="email-text" style="margin: 0 0 20px 0; font-size: 13px; color: #4a5568;">
                <a href="https://bulldogo.cz" style="color: #ff6a00; text-decoration: none;">bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="mailto:support@bulldogo.cz" style="color: #ff6a00; text-decoration: none;">support@bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="tel:+420605121023" style="color: #ff6a00; text-decoration: none;">+420 605 121 023</a>
              </p>
              <p class="email-text-light" style="margin: 0; font-size: 12px; color: #6b7280;">
                © 2026 BULLDOGO. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Firebase Firestore Trigger - Odešle email při změně údajů v profilu
 */
exports.sendProfileChangeEmail = functions
    .region("europe-west1")
    .firestore.document("users/{userId}/profile/profile")
    .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;
    // Nejdříve zkontrolovat, zda se mění pouze foto-related pole
    const photoRelatedFields = ["photoURL", "avatarUrl", "avatar", "avatarUpdatedAt"];
    // Zkontrolovat, zda se mění nějaké foto-related pole
    const photoChanges = [];
    for (const field of photoRelatedFields) {
        const oldVal = beforeData[field];
        const newVal = afterData[field];
        // Normalizovat hodnoty pro porovnání
        let oldNormalized = oldVal;
        let newNormalized = newVal;
        // Pro Timestamp objekty použít toDate()
        if (oldVal && typeof oldVal === 'object' && 'toDate' in oldVal) {
            oldNormalized = oldVal.toDate().getTime();
        }
        else if (oldVal === null || oldVal === undefined || oldVal === "") {
            oldNormalized = "";
        }
        else {
            oldNormalized = String(oldVal);
        }
        if (newVal && typeof newVal === 'object' && 'toDate' in newVal) {
            newNormalized = newVal.toDate().getTime();
        }
        else if (newVal === null || newVal === undefined || newVal === "") {
            newNormalized = "";
        }
        else {
            newNormalized = String(newVal);
        }
        if (oldNormalized !== newNormalized) {
            photoChanges.push(field);
        }
    }
    // Pokud se mění foto-related pole, zkontrolovat, zda se mění i něco jiného
    if (photoChanges.length > 0) {
        const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
        let hasOtherChanges = false;
        const otherChanges = [];
        for (const key of allKeys) {
            // Ignorovat všechny ignorovaná pole (včetně updatedAt)
            if (ignoredFields.includes(key))
                continue;
            // Ignorovat foto-related pole
            if (photoRelatedFields.includes(key))
                continue;
            const oldVal = beforeData[key];
            const newVal = afterData[key];
            // Normalizovat hodnoty pro porovnání (Timestamp objekty)
            let oldNormalized = oldVal;
            let newNormalized = newVal;
            if (oldVal && typeof oldVal === 'object' && 'toDate' in oldVal) {
                oldNormalized = oldVal.toDate().getTime();
            }
            else if (oldVal === null || oldVal === undefined || oldVal === "") {
                oldNormalized = "";
            }
            else {
                oldNormalized = String(oldVal);
            }
            if (newVal && typeof newVal === 'object' && 'toDate' in newVal) {
                newNormalized = newVal.toDate().getTime();
            }
            else if (newVal === null || newVal === undefined || newVal === "") {
                newNormalized = "";
            }
            else {
                newNormalized = String(newVal);
            }
            if (oldNormalized !== newNormalized) {
                hasOtherChanges = true;
                otherChanges.push(key);
                break; // Stačí najít jednu změnu
            }
        }
        // Pokud se mění pouze foto-related pole (a možná updatedAt, který je ignorován), neposílat email
        if (!hasOtherChanges) {
            functions.logger.info("Změna pouze profilové fotky, email se neposílá", {
                userId,
                photoChanges,
                beforeKeys: Object.keys(beforeData),
                afterKeys: Object.keys(afterData),
                allChangedKeys: Array.from(allKeys).filter(k => {
                    const oldVal = beforeData[k];
                    const newVal = afterData[k];
                    if (oldVal === undefined && newVal === undefined)
                        return false;
                    if (oldVal === undefined || newVal === undefined)
                        return true;
                    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
                })
            });
            return null;
        }
        else {
            functions.logger.info("Změna profilové fotky + další změny, email se posílá", {
                userId,
                photoChanges,
                otherChanges
            });
        }
    }
    // Získej změněná pole (ale ignoruj foto-related pole)
    const changes = getChangedFields(beforeData, afterData);
    // Pokud nejsou žádné relevantní změny, neposílej email
    if (changes.length === 0) {
        functions.logger.debug("Žádné relevantní změny v profilu", { userId });
        return null;
    }
    // Získej email uživatele - použij nový email pokud se změnil, jinak starý
    let email = afterData.email || beforeData.email;
    if (!email) {
        functions.logger.warn("Uživatel nemá email, přeskakuji odeslání emailu o změně", { userId });
        return null;
    }
    // Pokud se změnil email, poslat email na nový email
    const emailChanged = beforeData.email && afterData.email && beforeData.email !== afterData.email;
    if (emailChanged) {
        email = afterData.email; // Použít nový email
        functions.logger.info("Email se změnil, posílám notifikaci na nový email", {
            userId,
            oldEmail: beforeData.email,
            newEmail: afterData.email
        });
    }
    // Získej jméno uživatele
    let userName = "uživateli";
    if (afterData.firstName) {
        userName = afterData.firstName;
    }
    else if (afterData.name && afterData.name !== "Uživatel" && afterData.name !== "Firma") {
        userName = afterData.name.split(" ")[0];
    }
    else if (afterData.companyName) {
        userName = afterData.companyName;
    }
    const mailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: email,
        subject: "🔐 Změna údajů ve vašem účtu - Bulldogo.cz",
        html: generateProfileChangeEmailHTML(userName, changes),
        text: `Ahoj ${userName}!\n\nVe vašem účtu na Bulldogo.cz byly právě provedeny následující změny:\n\n${changes.map((c) => {
            if (c.field === 'passwordChangedAt') {
                return `${c.label}: Vaše heslo bylo změněno`;
            }
            return `${c.label}: ${formatValue(c.oldValue)} → ${formatValue(c.newValue)}`;
        }).join("\n")}\n\nPokud jste tyto změny neprovedli vy, okamžitě nás kontaktujte na support@bulldogo.cz nebo na tel. +420 605 121 023.\n\n© 2026 BULLDOGO`,
    };
    try {
        await smtpTransporter.sendMail(mailOptions);
        functions.logger.info("✅ Email o změně údajů úspěšně odeslán", {
            userId,
            email,
            changedFields: changes.map((c) => c.field),
        });
        return null;
    }
    catch (error) {
        functions.logger.error("❌ Chyba při odesílání emailu o změně údajů", {
            userId,
            email,
            error: error === null || error === void 0 ? void 0 : error.message,
        });
        return null;
    }
});
/**
 * Generuje HTML šablonu emailu o nové zprávě v chatu
 */
function generateNewMessageEmailHTML(recipientName, senderName, listingTitle, messageText) {
    const listingSection = listingTitle ? `
    <tr>
      <td style="padding: 0 40px 20px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="alert-warning" style="background: linear-gradient(135deg, #fff8eb 0%, #fff3e0 100%); border-radius: 12px; border: 1px solid #ffe0b2;">
          <tr>
            <td style="padding: 15px;">
                          <p class="alert-warning-title" style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
                <span style="margin-right: 8px;">📋</span> K inzerátu:
              </p>
              <p class="email-text-dark text-strong" style="margin: 8px 0 0 0; font-size: 16px; color: #1a1a2e; font-weight: 700;">
                ${listingTitle}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";
    // Zkrátit zprávu pokud je moc dlouhá
    const truncatedMessage = messageText.length > 500
        ? messageText.substring(0, 500) + "..."
        : messageText;
    return `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Nová zpráva - Bulldogo.cz</title>
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #ffffff !important; }
  </style>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-container { background-color: #1a1a1a !important; }
      .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-text-light { color: #b0b0b0 !important; }
      .email-text-dark { color: #ffffff !important; }
      .email-title { color: #ffffff !important; }
      .email-border { border-color: #404040 !important; }
      .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
      .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
      .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
      .alert-warning { 
        background: linear-gradient(135deg, #3d3021 0%, #2d2519 100%) !important; 
        border-color: #78350f !important; 
      }
      .alert-warning-title { 
        color: #fbbf24 !important; 
      }
      .text-strong { 
        color: #ffffff !important; 
      }
    }
    [data-ogsc] .email-body { background-color: #1a1a1a !important; }
    [data-ogsc] .email-container { background-color: #1a1a1a !important; }
    [data-ogsc] .email-card { background: linear-gradient(180deg, #2d2d2d 0%, #1f1f1f 100%) !important; }
    [data-ogsc] .email-text { color: #e5e5e5 !important; }
    [data-ogsc] .email-text-light { color: #b0b0b0 !important; }
    [data-ogsc] .email-text-dark { color: #ffffff !important; }
    [data-ogsc] .email-title { color: #ffffff !important; }
    [data-ogsc] .email-border { border-color: #404040 !important; }
    [data-ogsc] .email-bg-light { background: linear-gradient(135deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    [data-ogsc] .email-table { background-color: #2d2d2d !important; border-color: #404040 !important; }
    [data-ogsc] .email-table-header { background: linear-gradient(90deg, #3a3a3a 0%, #2d2d2d 100%) !important; }
    [data-ogsc] .alert-warning { 
      background: linear-gradient(135deg, #3d3021 0%, #2d2519 100%) !important; 
      border-color: #78350f !important; 
    }
    [data-ogsc] .alert-warning-title { 
      color: #fbbf24 !important; 
    }
    [data-ogsc] .text-strong { 
      color: #ffffff !important; 
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff; background: #ffffff; min-height: 100vh;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-container" style="background-color: #ffffff; background: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Hlavní kontejner -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo sekce -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%); border-radius: 20px; padding: 15px 25px; box-shadow: 0 10px 40px rgba(255, 106, 0, 0.3);">
                    <span style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
                      B<span style="background: linear-gradient(90deg, #ffffff 0%, #ffd700 100%); -webkit-background-clip: text; background-clip: text;">ULLDOGO</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Hlavní karta -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%); border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05); overflow: hidden;">
                
                <!-- Oranžový header pruh -->
                <tr>
                  <td style="background: linear-gradient(90deg, #ff6a00 0%, #ffa62b 50%, #fcd34d 100%); height: 8px;"></td>
                </tr>
                
                <!-- Ikona -->
                <tr>
                  <td align="center" style="padding: 40px 0 20px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 50%; width: 100px; height: 100px; text-align: center; line-height: 100px; box-shadow: 0 10px 30px rgba(255, 166, 43, 0.3);">
                          <span style="font-size: 50px;">💬</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Pozdrav -->
                <tr>
                  <td align="center" style="padding: 0 40px 20px 40px;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #1a1a2e; line-height: 1.3;">
                      Nová zpráva
                    </h1>
                  </td>
                </tr>
                
                <!-- Hlavní text -->
                <tr>
                  <td align="center" style="padding: 0 40px 25px 40px;">
                    <p class="email-text" style="margin: 0; font-size: 18px; line-height: 1.7; color: #4a5568;">
                      Ahoj, <strong style="color: #ff6a00;">${recipientName}</strong>!
                    </p>
                    <p class="email-text" style="margin: 10px 0 0 0; font-size: 16px; line-height: 1.7; color: #718096;">
                      Uživatel <strong class="email-text-dark" style="color: #1a1a2e;">${senderName}</strong> ti poslal novou zprávu.
                    </p>
                  </td>
                </tr>
                
                <!-- Inzerát (pokud existuje) -->
                ${listingSection}
                
                <!-- Zpráva -->
                <tr>
                  <td style="padding: 0 40px 30px 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-bg-light email-border" style="background: #f8f9fa; border-radius: 16px; border: 1px solid #e5e7eb;">
                      <tr>
                        <td style="padding: 20px;">
                          <p class="email-text-light" style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
                            Zpráva:
                          </p>
                          <p class="email-text-dark" style="margin: 0; font-size: 16px; line-height: 1.7; color: #1a1a2e; white-space: pre-wrap;">
                            ${truncatedMessage}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- CTA tlačítko -->
                <tr>
                  <td align="center" style="padding: 0 40px 30px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #ff6a00 0%, #ffa62b 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(255, 106, 0, 0.35);">
                          <a href="https://bulldogo.cz/chat.html" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.5px;">
                            ODPOVĚDĚT →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Info o vypnutí -->
                <tr>
                  <td align="center" style="padding: 0 40px 40px 40px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                      Tato oznámení můžete vypnout v 
                      <a href="https://bulldogo.cz/profile-settings.html" style="color: #ff6a00; text-decoration: none;">nastavení účtu</a>.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 40px 20px 20px 20px;">
              <p class="email-text" style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                „Služby jednoduše. Pro každého."
              </p>
              <p class="email-text" style="margin: 0 0 20px 0; font-size: 13px; color: #4a5568;">
                <a href="https://bulldogo.cz" style="color: #ff6a00; text-decoration: none;">bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="mailto:support@bulldogo.cz" style="color: #ff6a00; text-decoration: none;">support@bulldogo.cz</a> &nbsp;|&nbsp;
                <a href="tel:+420605121023" style="color: #ff6a00; text-decoration: none;">+420 605 121 023</a>
              </p>
              <p class="email-text-light" style="margin: 0; font-size: 12px; color: #6b7280;">
                © 2026 BULLDOGO. Všechna práva vyhrazena.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
/**
 * Firebase Firestore Trigger - Odešle email při nové zprávě v chatu
 */
exports.sendNewMessageEmail = functions
    .region("europe-west1")
    .firestore.document("chats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
    var _a;
    const db = admin.firestore();
    const messageData = snap.data();
    const chatId = context.params.chatId;
    const senderUid = messageData.fromUid;
    const messageText = messageData.text || "";
    // Pokud zpráva nemá text (jen obrázky), upravíme text
    const displayText = messageText || (((_a = messageData.images) === null || _a === void 0 ? void 0 : _a.length) > 0 ? "📷 Obrázek" : "");
    if (!displayText) {
        functions.logger.debug("Zpráva nemá obsah, přeskakuji email", { chatId });
        return null;
    }
    try {
        // Načíst chat dokument pro získání účastníků a info o inzerátu
        const chatDoc = await db.doc(`chats/${chatId}`).get();
        if (!chatDoc.exists) {
            functions.logger.warn("Chat dokument neexistuje", { chatId });
            return null;
        }
        const chatData = chatDoc.data();
        const participants = chatData.participants || [];
        const listingTitle = chatData.listingTitle || null;
        // Najít příjemce (druhý účastník)
        const recipientUid = participants.find((p) => p !== senderUid);
        if (!recipientUid) {
            functions.logger.warn("Nelze najít příjemce zprávy", { chatId, senderUid });
            return null;
        }
        // Načíst profil příjemce pro email a jméno
        const recipientProfileDoc = await db.doc(`users/${recipientUid}/profile/profile`).get();
        if (!recipientProfileDoc.exists) {
            functions.logger.warn("Profil příjemce neexistuje", { recipientUid });
            return null;
        }
        const recipientProfile = recipientProfileDoc.data();
        const recipientEmail = recipientProfile.email;
        // Kontrola, zda má uživatel povolené notifikace o nových zprávách
        if (recipientProfile.chatNotifications === false) {
            functions.logger.debug("Příjemce má vypnuté notifikace o nových zprávách", { recipientUid });
            return null;
        }
        if (!recipientEmail) {
            functions.logger.warn("Příjemce nemá email", { recipientUid });
            return null;
        }
        // Získat jméno příjemce
        let recipientName = "uživateli";
        if (recipientProfile.firstName) {
            recipientName = recipientProfile.firstName;
        }
        else if (recipientProfile.name && recipientProfile.name !== "Uživatel" && recipientProfile.name !== "Firma") {
            recipientName = recipientProfile.name.split(" ")[0];
        }
        else if (recipientProfile.companyName) {
            recipientName = recipientProfile.companyName;
        }
        // Načíst profil odesílatele pro jméno
        let senderName = "Někdo";
        try {
            const senderProfileDoc = await db.doc(`users/${senderUid}/profile/profile`).get();
            if (senderProfileDoc.exists) {
                const senderProfile = senderProfileDoc.data();
                if (senderProfile.firstName && senderProfile.lastName) {
                    senderName = `${senderProfile.firstName} ${senderProfile.lastName}`;
                }
                else if (senderProfile.name && senderProfile.name !== "Uživatel" && senderProfile.name !== "Firma") {
                    senderName = senderProfile.name;
                }
                else if (senderProfile.companyName) {
                    senderName = senderProfile.companyName;
                }
            }
        }
        catch (e) {
            functions.logger.debug("Nelze načíst profil odesílatele", { senderUid });
        }
        const mailOptions = {
            from: {
                name: "BULLDOGO",
                address: "info@bulldogo.cz",
            },
            to: recipientEmail,
            subject: `💬 Nová zpráva od ${senderName} - Bulldogo.cz`,
            html: generateNewMessageEmailHTML(recipientName, senderName, listingTitle, displayText),
            text: `Ahoj ${recipientName}!\n\nUživatel ${senderName} ti poslal novou zprávu${listingTitle ? ` k inzerátu "${listingTitle}"` : ""}.\n\nZpráva:\n${displayText}\n\nOdpověz na: https://bulldogo.cz/chat.html\n\n© 2026 BULLDOGO`,
        };
        await smtpTransporter.sendMail(mailOptions);
        functions.logger.info("✅ Email o nové zprávě odeslán", {
            recipientUid,
            recipientEmail,
            senderUid,
            senderName,
            chatId,
        });
        return null;
    }
    catch (error) {
        functions.logger.error("❌ Chyba při odesílání emailu o nové zprávě", {
            chatId,
            error: error === null || error === void 0 ? void 0 : error.message,
        });
        return null;
    }
});
/**
 * Firestore Trigger - Odešle fakturu při aktivaci Stripe subscription
 */
/**
 * VYPNUTO - Stripe automaticky generuje a posílá faktury
 * Tato funkce byla odstraněna - faktury se posílají automaticky přes Stripe
 */
// export const sendStripeInvoice = functions... (ODSTRANĚNO)
/**
 * VYPNUTO - Stripe automaticky generuje a posílá faktury
 * Tato funkce byla odstraněna - faktury se posílají automaticky přes Stripe
 */
// export const sendTopAdInvoiceOnCreate = functions... (ODSTRANĚNO)
/**
 * VYPNUTO - Stripe automaticky generuje a posílá faktury
 * Tato funkce byla odstraněna - faktury se posílají automaticky přes Stripe
 */
// export const sendTopAdInvoice = functions... (ODSTRANĚNO)
/**
 * VYPNUTO - Stripe automaticky generuje a posílá faktury
 * Tato funkce byla odstraněna - faktury se posílají automaticky přes Stripe
 */
// export const sendStripeInvoiceOnUpdate = functions... (ODSTRANĚNO)
/**
 * Firebase Auth Trigger - Odešle uvítací email při vytvoření nového uživatele
 */
exports.sendWelcomeEmail = functions
    .region("europe-west1")
    .auth.user()
    .onCreate(async (user) => {
    const email = user.email;
    if (!email) {
        functions.logger.warn("Nový uživatel nemá email, přeskakuji odeslání uvítacího emailu", { uid: user.uid });
        return null;
    }
    // Počkáme chvíli, aby se profil stihl vytvořit v databázi
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const userName = await getUserNameFromProfile(user.uid);
    const mailOptions = {
        from: {
            name: "BULLDOGO",
            address: "info@bulldogo.cz",
        },
        to: email,
        subject: "🎉 Vítejte na Bulldogo.cz!",
        html: generateWelcomeEmailHTML(userName),
        text: `Ahoj ${userName}!\n\nDěkujeme za registraci na portálu Bulldogo.cz!\n\nJsme rádi, že jste se stali součástí naší komunity. Nyní můžete využívat všechny výhody našeho portálu – vytvářet inzeráty, hledat služby a spojovat se s profesionály po celé České republice.\n\nNavštivte nás: https://bulldogo.cz\n\n„Služby jednoduše. Pro každého."\n\n© 2026 BULLDOGO`,
    };
    try {
        await smtpTransporter.sendMail(mailOptions);
        functions.logger.info("✅ Uvítací email úspěšně odeslán", {
            uid: user.uid,
            email: email,
            userName: userName
        });
        return null;
    }
    catch (error) {
        functions.logger.error("❌ Chyba při odesílání uvítacího emailu", {
            uid: user.uid,
            email: email,
            error: error === null || error === void 0 ? void 0 : error.message,
            code: error === null || error === void 0 ? void 0 : error.code
        });
        // Neházíme chybu, aby se registrace nedostala do chybového stavu
        return null;
    }
});
/**
 * Firebase Function - Nastaví admin status pro uživatele
 * Použití: POST s { uid: "user-uid" } nebo GET s ?uid=user-uid
 */
// HTTP funkce pro smazání Auth uživatele (volá se z admin panelu)
exports.deleteUserAuth = functions.region("europe-west1").https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c;
        try {
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed. Use POST." });
                return;
            }
            const uid = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.uid) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId);
            const adminUid = (_c = req.body) === null || _c === void 0 ? void 0 : _c.adminUid; // UID admina, který volá funkci
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: "Missing or invalid uid parameter" });
                return;
            }
            if (!adminUid || typeof adminUid !== "string") {
                res.status(400).json({ error: "Missing or invalid adminUid parameter" });
                return;
            }
            const db = admin.firestore();
            const auth = admin.auth();
            // Zkontrolovat autentifikaci z Authorization headeru
            const authHeader = req.headers.authorization;
            let verifiedAdminUid = null;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const idToken = authHeader.split('Bearer ')[1];
                    const decodedToken = await auth.verifyIdToken(idToken);
                    verifiedAdminUid = decodedToken.uid;
                    // Ověřit, že token UID odpovídá adminUid z body
                    if (verifiedAdminUid !== adminUid) {
                        res.status(403).json({ error: "Token UID does not match adminUid" });
                        return;
                    }
                }
                catch (error) {
                    functions.logger.error("❌ Chyba při ověřování tokenu", { error: error === null || error === void 0 ? void 0 : error.message });
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }
            }
            else {
                // Pokud není token, stále zkontrolovat admin status (pro zpětnou kompatibilitu)
                functions.logger.warn("⚠️ No Authorization token provided, checking admin status only");
            }
            // Zkontrolovat, jestli volající je admin
            try {
                const adminProfileDoc = await db.doc(`users/${adminUid}/profile/profile`).get();
                const adminProfile = adminProfileDoc.data();
                const isAdmin = (adminProfile === null || adminProfile === void 0 ? void 0 : adminProfile.isAdmin) === true || (adminProfile === null || adminProfile === void 0 ? void 0 : adminProfile.role) === "admin";
                if (!isAdmin) {
                    res.status(403).json({ error: "Forbidden. Only admins can delete users." });
                    return;
                }
            }
            catch (error) {
                functions.logger.error("❌ Chyba při kontrole admin statusu", { adminUid, error: error === null || error === void 0 ? void 0 : error.message });
                res.status(500).json({ error: "Failed to verify admin status" });
                return;
            }
            // Zkontrolovat, jestli uživatel existuje v Auth
            try {
                await auth.getUser(uid);
            }
            catch (error) {
                functions.logger.error("❌ Uživatel neexistuje v Auth", { uid, error: error === null || error === void 0 ? void 0 : error.message });
                res.status(404).json({
                    error: "User not found in Authentication",
                    message: "Uživatel s tímto UID neexistuje v Firebase Authentication",
                });
                return;
            }
            // Smazat Auth uživatele
            try {
                await auth.deleteUser(uid);
                functions.logger.info("✅ Auth uživatel smazán", { uid, deletedBy: adminUid });
                res.status(200).json({
                    success: true,
                    message: "User deleted from Authentication successfully",
                    uid: uid
                });
            }
            catch (error) {
                functions.logger.error("❌ Chyba při mazání Auth uživatele", { uid, error: error === null || error === void 0 ? void 0 : error.message });
                res.status(500).json({
                    error: "Failed to delete user from Authentication",
                    message: error === null || error === void 0 ? void 0 : error.message
                });
            }
        }
        catch (error) {
            functions.logger.error("❌ Chyba v deleteUserAuth funkci", { error: error === null || error === void 0 ? void 0 : error.message });
            res.status(500).json({ error: "Internal server error", message: error === null || error === void 0 ? void 0 : error.message });
        }
    });
});
exports.setAdminStatus = functions.region("europe-west1").https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a, _b, _c;
        try {
            if (req.method !== "POST" && req.method !== "GET") {
                res.status(405).json({ error: "Method not allowed. Use POST or GET." });
                return;
            }
            const uid = req.method === "POST" ? (((_a = req.body) === null || _a === void 0 ? void 0 : _a.uid) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.userId)) : (_c = req.query) === null || _c === void 0 ? void 0 : _c.uid;
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: "Missing or invalid uid parameter" });
                return;
            }
            const db = admin.firestore();
            const auth = admin.auth();
            // Zkontrolovat, jestli uživatel existuje v Auth
            let userRecord;
            try {
                userRecord = await auth.getUser(uid);
            }
            catch (error) {
                functions.logger.error("❌ Uživatel neexistuje v Auth", { uid, error: error === null || error === void 0 ? void 0 : error.message });
                res.status(404).json({
                    error: "User not found in Authentication",
                    message: "Uživatel s tímto UID neexistuje v Firebase Authentication",
                });
                return;
            }
            const userRef = db.collection("users").doc(uid);
            const profileRef = userRef.collection("profile").doc("profile");
            // Zkontrolovat, jestli už existuje profil
            const profileSnap = await profileRef.get();
            const userSnap = await userRef.get();
            // Vytvořit root dokument uživatele, pokud neexistuje
            if (!userSnap.exists) {
                await userRef.set({
                    uid: uid,
                    email: userRecord.email || "",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    userType: "person", // nebo "company" podle potřeby
                });
                functions.logger.info("✅ Root dokument uživatele vytvořen", { uid });
            }
            // Vytvořit nebo aktualizovat profil s admin statusem
            const profileData = {
                email: userRecord.email || "",
                name: userRecord.displayName || "Admin",
                isAdmin: true,
                role: "admin",
                adminSetAt: admin.firestore.FieldValue.serverTimestamp(),
                balance: 0,
                rating: 0,
                totalReviews: 0,
                ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                recentReviews: [],
                totalAds: 0,
                activeAds: 0,
                totalViews: 0,
                totalContacts: 0,
                emailNotifications: true,
                smsNotifications: false,
                marketingEmails: false,
            };
            // Pokud profil už existuje, použij merge, jinak vytvoř nový
            if (profileSnap.exists) {
                // Aktualizovat existující profil
                await profileRef.set({
                    isAdmin: true,
                    role: "admin",
                    adminSetAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                functions.logger.info("✅ Admin status nastaven (profil existoval)", { uid });
            }
            else {
                // Vytvořit nový profil
                profileData.createdAt = admin.firestore.FieldValue.serverTimestamp();
                await profileRef.set(profileData);
                functions.logger.info("✅ Nový profil vytvořen s admin statusem", { uid });
            }
            functions.logger.info("✅ Admin status nastaven", { uid, email: userRecord.email });
            res.status(200).json({
                success: true,
                message: "Admin status successfully set",
                uid: uid,
            });
        }
        catch (error) {
            functions.logger.error("❌ Chyba při nastavování admin statusu", {
                error: error === null || error === void 0 ? void 0 : error.message,
                stack: error === null || error === void 0 ? void 0 : error.stack,
            });
            res.status(500).json({
                error: "Failed to set admin status",
                message: error === null || error === void 0 ? void 0 : error.message,
            });
        }
    });
});
/**
 * Stripe Webhook - Odešle kopii faktury na účetní email
 * Tento webhook zachytí invoice.finalized event a pošle kopii faktury na ucetni@bulldogo.cz
 *
 * Nastavení webhooku v Stripe Dashboard:
 * 1. Jdi do Developers → Webhooks
 * 2. Přidej endpoint: https://europe-west1-inzerio-inzerce.cloudfunctions.net/stripeInvoiceWebhook
 * 3. Vyber event: invoice.finalized
 * 4. Zkopíruj webhook signing secret a nastav ho jako STRIPE_WEBHOOK_SECRET v Firebase Functions environment
 */
exports.stripeInvoiceWebhook = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
    // Povolit pouze POST požadavky
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const accountingEmail = "ucetni@bulldogo.cz";
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        functions.logger.error("❌ Stripe signature missing");
        res.status(400).send("Stripe signature missing");
        return;
    }
    try {
        const event = req.body;
        // Zpracovat pouze invoice.finalized eventy
        if (event.type === "invoice.finalized") {
            const invoice = event.data.object;
            const invoiceId = invoice.id;
            const customerId = invoice.customer;
            const amount = invoice.amount_paid || invoice.amount_due;
            const currency = (invoice.currency || "czk").toUpperCase();
            const invoiceNumber = invoice.number || invoiceId;
            const invoicePdf = invoice.invoice_pdf;
            const customerEmail = invoice.customer_email;
            const subscriptionId = invoice.subscription;
            functions.logger.info("📧 Invoice finalized event received", {
                invoiceId,
                customerId,
                amount,
                currency,
                invoiceNumber,
                customerEmail,
            });
            // Získat informace o zákazníkovi z Firestore
            let userId = null;
            let userName = "Neznámý zákazník";
            let userEmail = customerEmail;
            if (customerId) {
                try {
                    const db = admin.firestore();
                    // Zkusit najít uživatele podle Stripe customer ID (Firebase Extension ukládá customer ID jako document ID)
                    const customerDoc = await db.collection("customers").doc(customerId).get();
                    if (customerDoc.exists) {
                        userId = customerId;
                        const userProfileDoc = await db
                            .collection("users")
                            .doc(userId)
                            .collection("profile")
                            .doc("profile")
                            .get();
                        if (userProfileDoc.exists) {
                            const userProfile = userProfileDoc.data();
                            const firstName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.firstName) || "";
                            const lastName = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.lastName) || "";
                            const name = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.name) || "";
                            const companyName = userProfile === null || userProfile === void 0 ? void 0 : userProfile.companyName;
                            if (firstName && lastName) {
                                userName = `${firstName} ${lastName}`;
                            }
                            else if (name && name !== "Uživatel" && name !== "Firma") {
                                userName = name;
                            }
                            else if (companyName) {
                                userName = companyName;
                            }
                            userEmail = (userProfile === null || userProfile === void 0 ? void 0 : userProfile.email) || customerEmail || userEmail;
                        }
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not fetch user data", {
                        error: error === null || error === void 0 ? void 0 : error.message,
                        customerId,
                    });
                }
            }
            // Vytvořit email s kopií faktury pro účetní
            const amountFormatted = (amount / 100).toFixed(2); // Stripe ukládá v centech
            const invoiceType = amount === 0 ? "Free Trial" : subscriptionId ? "Předplatné" : "Topování inzerátu";
            const accountingEmailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-box { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Kopie faktury - BULLDOGO</h1>
    </div>
    <div class="content">
      <div class="info-box">
        <h2>Informace o faktuře</h2>
        <p><strong>Číslo faktury:</strong> ${invoiceNumber}</p>
        <p><strong>Typ:</strong> ${invoiceType}</p>
        <p><strong>Částka:</strong> ${amountFormatted} ${currency}</p>
        <p><strong>Zákazník:</strong> ${userName}</p>
        <p><strong>Email zákazníka:</strong> ${userEmail || "neuvedeno"}</p>
        ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
        ${customerId ? `<p><strong>Stripe Customer ID:</strong> ${customerId}</p>` : ""}
      </div>
      ${invoicePdf ? `<p><a href="${invoicePdf}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Stáhnout PDF faktury</a></p>` : ""}
      <p>Faktura byla automaticky vytvořena Stripe a odeslána zákazníkovi.</p>
    </div>
    <div class="footer">
      <p>© 2026 BULLDOGO.CZ</p>
      <p>Tento email byl automaticky vygenerován systémem.</p>
    </div>
  </div>
</body>
</html>
        `;
            const accountingEmailText = `
Kopie faktury - BULLDOGO

Číslo faktury: ${invoiceNumber}
Typ: ${invoiceType}
Částka: ${amountFormatted} ${currency}
Zákazník: ${userName}
Email zákazníka: ${userEmail || "neuvedeno"}
${userId ? `User ID: ${userId}` : ""}
${customerId ? `Stripe Customer ID: ${customerId}` : ""}

${invoicePdf ? `PDF faktury: ${invoicePdf}` : ""}

Faktura byla automaticky vytvořena Stripe a odeslána zákazníkovi.

© 2026 BULLDOGO.CZ
        `;
            // Vytvořit email pro zákazníka
            const customerEmailHTML = `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]>
  <style type="text/css">
    body, table { background-color: #f5f5f5 !important; }
    .email-body { background-color: #f5f5f5 !important; }
    .email-container { background-color: #f5f5f5 !important; }
    .email-card { background-color: #ffffff !important; }
    .email-text { color: #1a1a1a !important; }
  </style>
  <![endif]-->
  <style>
    /* Vynutit světlý režim pro lepší čitelnost */
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #1a1a1a !important; 
      background-color: #f5f5f5 !important;
      margin: 0;
      padding: 0;
    }
    .email-body { 
      background-color: #f5f5f5 !important; 
      padding: 20px 0;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff !important;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%) !important; 
      color: #111827 !important; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      color: #111827 !important;
    }
    .content { 
      padding: 30px 20px; 
      background-color: #ffffff !important; 
      color: #1a1a1a !important;
    }
    .content p {
      color: #1a1a1a !important;
      margin: 15px 0;
    }
    .info-box { 
      background-color: #f9fafb !important; 
      padding: 20px; 
      margin: 20px 0; 
      border-radius: 8px; 
      border: 1px solid #e5e7eb !important;
    }
    .info-box h2 {
      margin-top: 0;
      color: #111827 !important;
    }
    .info-box p {
      color: #1a1a1a !important;
      margin: 10px 0;
    }
    .info-box strong {
      color: #000000 !important;
    }
    .amount-box { 
      background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%) !important; 
      color: #111827 !important; 
      padding: 20px; 
      margin: 20px 0; 
      border-radius: 8px; 
      text-align: center; 
      font-size: 24px; 
      font-weight: bold;
    }
    .button { 
      display: inline-block; 
      padding: 12px 30px; 
      background-color: #f77c00 !important; 
      color: #ffffff !important; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 20px 0; 
      font-weight: bold;
    }
    .footer { 
      text-align: center; 
      padding: 20px; 
      color: #6b7280 !important; 
      font-size: 12px; 
      background-color: #f9fafb !important;
    }
    a {
      color: #f77c00 !important;
    }
    /* Vynutit světlý režim i v tmavém módu */
    @media (prefers-color-scheme: dark) {
      body { 
        background-color: #f5f5f5 !important; 
        color: #1a1a1a !important;
      }
      .email-body { 
        background-color: #f5f5f5 !important; 
      }
      .container { 
        background-color: #ffffff !important; 
      }
      .content { 
        background-color: #ffffff !important; 
        color: #1a1a1a !important;
      }
      .content p {
        color: #1a1a1a !important;
      }
      .info-box { 
        background-color: #f9fafb !important; 
        border-color: #e5e7eb !important;
      }
      .info-box p {
        color: #1a1a1a !important;
      }
      .footer { 
        background-color: #f9fafb !important; 
        color: #6b7280 !important;
      }
    }
  </style>
</head>
<body style="background-color: #f5f5f5; margin: 0; padding: 0;">
  <div class="email-body">
    <div class="container">
      <div class="header">
        <h1 style="margin: 0; font-size: 28px; color: #111827 !important;">Faktura - BULLDOGO</h1>
      </div>
      <div class="content">
        <p style="color: #1a1a1a !important;">Dobrý den ${userName},</p>
        <p style="color: #1a1a1a !important;">děkujeme za využívání našich služeb. Připravili jsme pro vás fakturu za ${invoiceType.toLowerCase()}.</p>
        
        <div class="info-box">
          <h2 style="margin-top: 0; color: #111827 !important;">Detaily faktury</h2>
          <p style="color: #1a1a1a !important;"><strong style="color: #000000 !important;">Číslo faktury:</strong> ${invoiceNumber}</p>
          <p style="color: #1a1a1a !important;"><strong style="color: #000000 !important;">Typ služby:</strong> ${invoiceType}</p>
          ${subscriptionId ? `<p style="color: #1a1a1a !important;"><strong style="color: #000000 !important;">Předplatné:</strong> Aktivní</p>` : ""}
        </div>

        <div class="amount-box">
          Částka: ${amountFormatted} ${currency}
        </div>

        ${invoicePdf ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invoicePdf}" class="button" style="display: inline-block; padding: 12px 30px; background-color: #f77c00 !important; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold;">Stáhnout PDF faktury</a>
        </div>
        ` : ""}

        <p style="color: #1a1a1a !important;">Faktura byla automaticky vygenerována a je k dispozici ve vašem účtu.</p>
        
        <p style="color: #1a1a1a !important;">Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat na <a href="mailto:info@bulldogo.cz" style="color: #f77c00 !important;">info@bulldogo.cz</a>.</p>
        
        <p style="color: #1a1a1a !important;">S pozdravem,<br>Tým BULLDOGO</p>
      </div>
      <div class="footer">
        <p style="color: #6b7280 !important; margin: 5px 0;">© 2026 BULLDOGO.CZ</p>
        <p style="color: #6b7280 !important; margin: 5px 0;">Tento email byl automaticky vygenerován systémem.</p>
      </div>
    </div>
  </div>
</body>
</html>
        `;
            const customerEmailText = `
Faktura - BULLDOGO

Dobrý den ${userName},

děkujeme za využívání našich služeb. Připravili jsme pro vás fakturu za ${invoiceType.toLowerCase()}.

Detaily faktury:
Číslo faktury: ${invoiceNumber}
Typ služby: ${invoiceType}
${subscriptionId ? "Předplatné: Aktivní" : ""}
Částka: ${amountFormatted} ${currency}

${invoicePdf ? `PDF faktury: ${invoicePdf}` : ""}

Faktura byla automaticky vygenerována a je k dispozici ve vašem účtu.

Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat na info@bulldogo.cz.

S pozdravem,
Tým BULLDOGO

© 2026 BULLDOGO.CZ
        `;
            // Odeslat email zákazníkovi (pokud má email)
            if (userEmail && userEmail.trim().length > 0) {
                try {
                    const customerMailOptions = {
                        from: {
                            name: "BULLDOGO",
                            address: "info@bulldogo.cz",
                        },
                        to: userEmail,
                        subject: `Faktura ${invoiceNumber} - BULLDOGO`,
                        html: customerEmailHTML,
                        text: customerEmailText,
                    };
                    await smtpTransporter.sendMail(customerMailOptions);
                    functions.logger.info("✅ Faktura odeslána zákazníkovi", {
                        invoiceId,
                        invoiceNumber,
                        customerEmail: userEmail,
                        userId,
                        userName,
                        invoiceType,
                    });
                }
                catch (customerEmailError) {
                    functions.logger.error("❌ Chyba při odesílání faktury zákazníkovi", {
                        error: customerEmailError === null || customerEmailError === void 0 ? void 0 : customerEmailError.message,
                        customerEmail: userEmail,
                        invoiceId,
                    });
                    // Pokračujeme i když se nepodařilo poslat zákazníkovi - účetní email musí být odeslán
                }
            }
            else {
                functions.logger.warn("⚠️ Zákazník nemá email, faktura nebyla odeslána", {
                    invoiceId,
                    customerId,
                    userId,
                });
            }
            // Odeslat email na účetní
            const accountingMailOptions = {
                from: {
                    name: "BULLDOGO",
                    address: "info@bulldogo.cz",
                },
                to: accountingEmail,
                subject: `Kopie faktury ${invoiceNumber} - ${userName}${userId ? ` (UID: ${userId})` : ""}`,
                html: accountingEmailHTML,
                text: accountingEmailText,
            };
            await smtpTransporter.sendMail(accountingMailOptions);
            functions.logger.info("✅ Kopie faktury odeslána na účetní email", {
                invoiceId,
                invoiceNumber,
                accountingEmail,
                userId,
                userName,
            });
        }
        // Vrátit úspěšnou odpověď Stripe
        res.status(200).json({ received: true });
    }
    catch (error) {
        functions.logger.error("❌ Chyba při zpracování Stripe webhooku", {
            error: error === null || error === void 0 ? void 0 : error.message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
        });
        res.status(500).json({ error: error === null || error === void 0 ? void 0 : error.message });
    }
});
// ============================================
// STRIPE CUSTOMER PORTAL SESSION
// ============================================
/**
 * Vytvoří Stripe Customer Portal session pro správu předplatného
 */
exports.createBillingPortalSession = functions
    .region("europe-west1")
    .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
    .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        try {
            functions.logger.info("📥 createBillingPortalSession called", {
                method: req.method,
                hasBody: !!req.body,
                bodyType: typeof req.body,
                headers: {
                    contentType: req.headers["content-type"],
                    authorization: req.headers.authorization ? "present" : "missing"
                }
            });
            // Kontrola metody
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed" });
                return;
            }
            // Získat return URL z requestu
            const body = req.body || {};
            const { returnUrl, uid } = body;
            functions.logger.info("📋 Request body parsed", {
                returnUrl: returnUrl ? `${returnUrl.substring(0, 50)}...` : "missing",
                uid: uid ? `${uid.substring(0, 10)}...` : "missing",
                bodyKeys: Object.keys(body)
            });
            if (!returnUrl || typeof returnUrl !== 'string' || returnUrl.trim().length === 0) {
                functions.logger.error("❌ Missing or invalid returnUrl", { returnUrl, type: typeof returnUrl });
                res.status(400).json({ error: "Missing or invalid returnUrl parameter" });
                return;
            }
            // Validovat, že returnUrl je validní URL
            try {
                new URL(returnUrl);
            }
            catch (e) {
                res.status(400).json({ error: "Invalid returnUrl format. Must be a valid URL." });
                return;
            }
            // Získat UID z Authorization header nebo z requestu
            let userId = uid || null;
            const authHeader = req.headers.authorization;
            if (authHeader && typeof authHeader === 'string' && authHeader.startsWith("Bearer ")) {
                try {
                    const token = authHeader.substring(7).trim(); // Odstranit "Bearer " a whitespace
                    // Ověřit, že token neobsahuje neplatné znaky
                    if (token && /^[A-Za-z0-9._-]+$/.test(token)) {
                        const decodedToken = await admin.auth().verifyIdToken(token);
                        userId = decodedToken.uid;
                    }
                    else {
                        functions.logger.warn("⚠️ Invalid token format", { tokenLength: token === null || token === void 0 ? void 0 : token.length });
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not verify token", { error });
                }
            }
            if (!userId) {
                res.status(401).json({ error: "Unauthorized - missing user ID" });
                return;
            }
            // Získat Stripe customer ID z Firestore
            // Firebase Extension ukládá subscriptions pod customers/{uid}/subscriptions, kde uid je Firebase UID
            // Stripe customer ID je v subscription dokumentu v poli "customer" a MUSÍ začínat na "cus_"
            // NEBO Extension může ukládat customer dokumenty s Stripe customer ID jako document ID
            const db = admin.firestore();
            let stripeCustomerId = null;
            // 0) Nejdřív zkusit najít customer dokument s UID jako ID a získat Stripe customer ID z něj
            try {
                const customerDocByUid = await db.collection("customers").doc(userId).get();
                if (customerDocByUid.exists) {
                    const customerData = customerDocByUid.data();
                    functions.logger.info("📄 Customer document (step 0)", {
                        docId: customerDocByUid.id,
                        hasId: !!(customerData === null || customerData === void 0 ? void 0 : customerData.id),
                        hasStripeId: !!(customerData === null || customerData === void 0 ? void 0 : customerData.stripeId),
                        idValue: (customerData === null || customerData === void 0 ? void 0 : customerData.id) ? String(customerData.id).substring(0, 30) : null,
                        stripeIdValue: (customerData === null || customerData === void 0 ? void 0 : customerData.stripeId) ? String(customerData.stripeId).substring(0, 30) : null,
                        allKeys: Object.keys(customerData || {})
                    });
                    // Zkusit získat customer ID z dokumentu - zkontrolovat id, stripeId, nebo stripeCustomerId
                    // stripeId může být string nebo Firestore reference
                    let candidateId = null;
                    if ((customerData === null || customerData === void 0 ? void 0 : customerData.id) && typeof customerData.id === 'string') {
                        candidateId = customerData.id;
                    }
                    else if (customerData === null || customerData === void 0 ? void 0 : customerData.stripeId) {
                        // stripeId může být string nebo Firestore reference
                        if (typeof customerData.stripeId === 'string') {
                            candidateId = customerData.stripeId;
                        }
                        else if ((_a = customerData.stripeId) === null || _a === void 0 ? void 0 : _a.id) {
                            // Firestore reference má .id property
                            candidateId = customerData.stripeId.id;
                        }
                        else if ((_b = customerData.stripeId) === null || _b === void 0 ? void 0 : _b.path) {
                            // Firestore reference má .path property - zkusit extrahovat ID z path
                            const pathParts = customerData.stripeId.path.split('/');
                            candidateId = pathParts[pathParts.length - 1];
                        }
                    }
                    else if ((customerData === null || customerData === void 0 ? void 0 : customerData.stripeCustomerId) && typeof customerData.stripeCustomerId === 'string') {
                        candidateId = customerData.stripeCustomerId;
                    }
                    functions.logger.info("🔍 Checking candidate ID", {
                        candidateId: candidateId ? candidateId.substring(0, 30) : null,
                        startsWithCus: candidateId ? candidateId.startsWith('cus_') : false,
                        rawId: customerData === null || customerData === void 0 ? void 0 : customerData.id,
                        rawStripeId: customerData === null || customerData === void 0 ? void 0 : customerData.stripeId,
                        rawStripeIdType: typeof (customerData === null || customerData === void 0 ? void 0 : customerData.stripeId),
                        rawStripeCustomerId: customerData === null || customerData === void 0 ? void 0 : customerData.stripeCustomerId
                    });
                    if (candidateId && typeof candidateId === 'string' && candidateId.startsWith('cus_')) {
                        stripeCustomerId = candidateId;
                        functions.logger.info("✅ Found customer ID in document", { stripeCustomerId });
                    }
                }
            }
            catch (error) {
                functions.logger.warn("⚠️ Could not check customer document", { error, userId });
            }
            // 1) Nejdřív zkusit najít z aktivní subscription (nejspolehlivější způsob)
            try {
                const subscriptionsRef = db.collection("customers").doc(userId).collection("subscriptions");
                const activeSubs = await subscriptionsRef.where("status", "in", ["trialing", "active"]).limit(1).get();
                functions.logger.info("🔍 Checking subscriptions", {
                    userId,
                    subscriptionsFound: activeSubs.size,
                    path: `customers/${userId}/subscriptions`
                });
                if (!activeSubs.empty) {
                    const subData = activeSubs.docs[0].data();
                    functions.logger.info("📄 Subscription data", {
                        hasCustomer: !!(subData === null || subData === void 0 ? void 0 : subData.customer),
                        customerType: typeof (subData === null || subData === void 0 ? void 0 : subData.customer),
                        customerValue: (subData === null || subData === void 0 ? void 0 : subData.customer) ? (typeof subData.customer === 'string' ? subData.customer.substring(0, 30) : 'object') : 'null',
                        subscriptionId: activeSubs.docs[0].id,
                        allKeys: Object.keys(subData)
                    });
                    // Customer ID může být string nebo objekt s id
                    if (typeof (subData === null || subData === void 0 ? void 0 : subData.customer) === 'string' && subData.customer.startsWith('cus_')) {
                        stripeCustomerId = subData.customer;
                    }
                    else if (((_c = subData === null || subData === void 0 ? void 0 : subData.customer) === null || _c === void 0 ? void 0 : _c.id) && typeof subData.customer.id === 'string' && subData.customer.id.startsWith('cus_')) {
                        stripeCustomerId = subData.customer.id;
                    }
                    else if (subData === null || subData === void 0 ? void 0 : subData.customer) {
                        // Pokud je to reference nebo jiný formát, zkusit získat ID
                        const customerStr = String(subData.customer);
                        if (customerStr.startsWith('cus_')) {
                            stripeCustomerId = customerStr;
                        }
                    }
                    // Pokud stále nemáme customer ID, zkusit najít v customer dokumentu
                    if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                        const customerDoc = await db.collection("customers").doc(userId).get();
                        if (customerDoc.exists) {
                            const customerData = customerDoc.data();
                            functions.logger.info("📄 Customer document found", {
                                docId: customerDoc.id,
                                hasId: !!(customerData === null || customerData === void 0 ? void 0 : customerData.id),
                                idValue: (customerData === null || customerData === void 0 ? void 0 : customerData.id) ? String(customerData.id).substring(0, 30) : null,
                                allKeys: Object.keys(customerData || {})
                            });
                            // Zkusit získat customer ID z dokumentu - zkontrolovat id, stripeId, nebo stripeCustomerId
                            const candidateId = (customerData === null || customerData === void 0 ? void 0 : customerData.id) || (customerData === null || customerData === void 0 ? void 0 : customerData.stripeId) || (customerData === null || customerData === void 0 ? void 0 : customerData.stripeCustomerId);
                            if (candidateId && typeof candidateId === 'string' && candidateId.startsWith('cus_')) {
                                stripeCustomerId = candidateId;
                                functions.logger.info("✅ Found customer ID in customer document", { stripeCustomerId });
                            }
                            else if (customerDoc.id && customerDoc.id.startsWith('cus_')) {
                                // Document ID je Stripe customer ID
                                stripeCustomerId = customerDoc.id;
                            }
                        }
                    }
                }
                else {
                    functions.logger.warn("⚠️ No active subscriptions found", { userId });
                }
            }
            catch (error) {
                functions.logger.warn("⚠️ Could not find customer ID from subscriptions", { error, userId });
            }
            // 2) Pokud nenajdeme, zkusit najít customer dokument s UID jako ID (pokud jsme to ještě nezkusili)
            // Firebase Extension může ukládat customer dokumenty s UID jako ID
            if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                try {
                    const customerDocByUid = await db.collection("customers").doc(userId).get();
                    if (customerDocByUid.exists) {
                        const customerData = customerDocByUid.data();
                        functions.logger.info("📄 Customer document data (step 2)", {
                            hasId: !!(customerData === null || customerData === void 0 ? void 0 : customerData.id),
                            idValue: (customerData === null || customerData === void 0 ? void 0 : customerData.id) ? String(customerData.id).substring(0, 30) : null,
                            hasStripeCustomerId: !!(customerData === null || customerData === void 0 ? void 0 : customerData.stripeCustomerId),
                            docId: customerDocByUid.id,
                            docIdStartsWithCus: customerDocByUid.id.startsWith('cus_'),
                            allKeys: Object.keys(customerData || {})
                        });
                        // Zkusit získat customer ID z dokumentu - zkontrolovat id, stripeId, nebo stripeCustomerId
                        const candidateId = (customerData === null || customerData === void 0 ? void 0 : customerData.id) || (customerData === null || customerData === void 0 ? void 0 : customerData.stripeId) || (customerData === null || customerData === void 0 ? void 0 : customerData.stripeCustomerId);
                        if (candidateId && typeof candidateId === 'string' && candidateId.startsWith('cus_')) {
                            stripeCustomerId = candidateId;
                            functions.logger.info("✅ Found customer ID in customer document (step 2)", { stripeCustomerId });
                        }
                        else if (customerDocByUid.id && customerDocByUid.id.startsWith('cus_')) {
                            // Document ID je Stripe customer ID (Extension ukládá customer dokumenty s Stripe customer ID jako ID)
                            stripeCustomerId = customerDocByUid.id;
                        }
                    }
                    else {
                        functions.logger.warn("⚠️ Customer document not found", { userId, path: `customers/${userId}` });
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not find customer document by UID", { error, userId });
                }
            }
            // 3) Pokud stále nemáme customer ID, zkusit najít v checkout sessions
            if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                try {
                    const checkoutSessionsRef = db.collection("customers").doc(userId).collection("checkout_sessions");
                    const checkoutSessions = await checkoutSessionsRef.orderBy("created", "desc").limit(1).get();
                    if (!checkoutSessions.empty) {
                        const sessionData = checkoutSessions.docs[0].data();
                        functions.logger.info("📄 Checkout session data", {
                            hasCustomer: !!(sessionData === null || sessionData === void 0 ? void 0 : sessionData.customer),
                            customerValue: (sessionData === null || sessionData === void 0 ? void 0 : sessionData.customer) ? String(sessionData.customer).substring(0, 30) : null
                        });
                        if ((sessionData === null || sessionData === void 0 ? void 0 : sessionData.customer) && typeof sessionData.customer === 'string' && sessionData.customer.startsWith('cus_')) {
                            stripeCustomerId = sessionData.customer;
                            functions.logger.info("✅ Found customer ID in checkout session", { stripeCustomerId });
                        }
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not find customer ID from checkout sessions", { error, userId });
                }
            }
            // 4) Pokud stále nemáme customer ID, zkusit najít podle emailu v customers kolekci
            if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                try {
                    // Získat email uživatele
                    const userRecord = await admin.auth().getUser(userId);
                    const userEmail = userRecord.email;
                    if (userEmail) {
                        // Prohledat všechny customer dokumenty (Extension ukládá customer dokumenty s Stripe customer ID jako ID)
                        const allCustomers = await db.collection("customers").limit(200).get();
                        functions.logger.info("🔍 Searching all customers", { totalCustomers: allCustomers.size });
                        for (const customerDoc of allCustomers.docs) {
                            const customerData = customerDoc.data();
                            // Zkontrolovat, zda document ID je Stripe customer ID a dokument obsahuje metadata s firebaseUID
                            if (customerDoc.id.startsWith('cus_')) {
                                if (((_d = customerData === null || customerData === void 0 ? void 0 : customerData.metadata) === null || _d === void 0 ? void 0 : _d.firebaseUID) === userId || (customerData === null || customerData === void 0 ? void 0 : customerData.email) === userEmail) {
                                    stripeCustomerId = customerDoc.id; // Document ID je Stripe customer ID
                                    functions.logger.info("✅ Found customer ID by email/metadata", { stripeCustomerId });
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not find customer ID by email", { error, userId });
                }
            }
            // 4) Validovat, že customer ID má správný formát (musí začínat na "cus_")
            if (stripeCustomerId && !stripeCustomerId.startsWith('cus_')) {
                functions.logger.error("❌ Invalid Stripe customer ID format", {
                    customerId: stripeCustomerId,
                    userId
                });
                stripeCustomerId = null; // Resetovat, protože není validní
            }
            if (!stripeCustomerId) {
                functions.logger.error("❌ Stripe customer ID not found for user", {
                    userId,
                    checkedSubscriptions: true,
                    checkedCustomerDoc: true
                });
                res.status(404).json({
                    error: "Stripe customer ID not found. Please ensure you have an active subscription.",
                    details: "No active subscription found for this user."
                });
                return;
            }
            functions.logger.info("✅ Found Stripe customer ID", { userId, stripeCustomerId });
            // Získat Stripe Secret Key z environment variables nebo secrets
            // Podporujeme oba způsoby: process.env (pro secrets) nebo functions.config (pro legacy)
            const stripeSecretKey = process.env.STRIPE_SECRET_KEY ||
                ((_e = functions.config().stripe) === null || _e === void 0 ? void 0 : _e.secret_key);
            if (!stripeSecretKey || typeof stripeSecretKey !== 'string' || stripeSecretKey.trim().length === 0) {
                functions.logger.error("❌ STRIPE_SECRET_KEY not set in environment variables or functions.config");
                res.status(500).json({ error: "Stripe configuration error" });
                return;
            }
            // Ověřit, že secret key má správný formát (začíná sk_)
            const cleanedSecretKey = stripeSecretKey.trim();
            if (!cleanedSecretKey.startsWith('sk_')) {
                functions.logger.error("❌ STRIPE_SECRET_KEY has invalid format");
                res.status(500).json({ error: "Stripe configuration error" });
                return;
            }
            // Validovat customer ID před voláním Stripe API
            if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                functions.logger.error("❌ Invalid Stripe customer ID before API call", {
                    customerId: stripeCustomerId,
                    userId,
                    isValid: stripeCustomerId ? stripeCustomerId.startsWith('cus_') : false
                });
                res.status(400).json({
                    error: "Invalid Stripe customer ID. Customer ID must start with 'cus_'.",
                    details: "No valid Stripe customer found for this user."
                });
                return;
            }
            // Vytvořit billing portal session přes Stripe API
            functions.logger.info("🔄 Calling Stripe API", {
                stripeCustomerId,
                returnUrl,
                hasSecretKey: !!cleanedSecretKey,
                customerIdLength: stripeCustomerId.length,
                customerIdPrefix: stripeCustomerId.substring(0, 10)
            });
            let stripeResponse;
            try {
                // Stripe API vyžaduje form-urlencoded data
                const formData = new URLSearchParams();
                formData.append('customer', stripeCustomerId);
                formData.append('return_url', returnUrl);
                stripeResponse = await axios_1.default.post("https://api.stripe.com/v1/billing_portal/sessions", formData.toString(), {
                    headers: {
                        Authorization: `Bearer ${cleanedSecretKey}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });
            }
            catch (stripeError) {
                functions.logger.error("❌ Stripe API error", {
                    status: (_f = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _f === void 0 ? void 0 : _f.status,
                    statusText: (_g = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _g === void 0 ? void 0 : _g.statusText,
                    data: (_h = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _h === void 0 ? void 0 : _h.data,
                    message: stripeError === null || stripeError === void 0 ? void 0 : stripeError.message
                });
                // Pokud Stripe vrací 400, zkusit získat detailnější chybu
                if (((_j = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _j === void 0 ? void 0 : _j.status) === 400) {
                    const stripeErrorData = (_k = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _k === void 0 ? void 0 : _k.data;
                    const errorMessage = ((_l = stripeErrorData === null || stripeErrorData === void 0 ? void 0 : stripeErrorData.error) === null || _l === void 0 ? void 0 : _l.message) || (stripeErrorData === null || stripeErrorData === void 0 ? void 0 : stripeErrorData.message) || "Invalid request to Stripe";
                    res.status(400).json({
                        error: errorMessage,
                        details: (stripeErrorData === null || stripeErrorData === void 0 ? void 0 : stripeErrorData.error) || stripeErrorData
                    });
                    return;
                }
                // Pro ostatní chyby vrátit 500
                res.status(500).json({
                    error: ((_p = (_o = (_m = stripeError === null || stripeError === void 0 ? void 0 : stripeError.response) === null || _m === void 0 ? void 0 : _m.data) === null || _o === void 0 ? void 0 : _o.error) === null || _p === void 0 ? void 0 : _p.message) || (stripeError === null || stripeError === void 0 ? void 0 : stripeError.message) || "Failed to create portal session"
                });
                return;
            }
            const portalUrl = stripeResponse.data.url;
            if (!portalUrl) {
                functions.logger.error("❌ No URL in Stripe response", { response: stripeResponse.data });
                res.status(500).json({ error: "Failed to create portal session - no URL returned" });
                return;
            }
            functions.logger.info("✅ Billing portal session created", {
                uid: userId,
                stripeCustomerId,
                returnUrl,
            });
            res.status(200).json({ url: portalUrl });
        }
        catch (error) {
            functions.logger.error("❌ Chyba při vytváření billing portal session", {
                error: error === null || error === void 0 ? void 0 : error.message,
                stack: error === null || error === void 0 ? void 0 : error.stack,
                name: error === null || error === void 0 ? void 0 : error.name
            });
            res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "Internal server error" });
        }
    });
});
/**
 * Vytvoří Stripe Checkout Session s backend kontrolou trial historie
 * Zajišťuje, že trial se nastaví pouze pokud uživatel ještě trial neměl
 */
exports.createCheckoutSession = functions
    .region("europe-west1")
    .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
    .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            functions.logger.info("📥 createCheckoutSession called", {
                method: req.method,
                hasBody: !!req.body
            });
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed" });
                return;
            }
            const body = req.body || {};
            const { priceId, planId, successUrl, cancelUrl, uid } = body;
            // Validace vstupů
            if (!priceId || typeof priceId !== 'string') {
                res.status(400).json({ error: "Missing or invalid priceId" });
                return;
            }
            if (!successUrl || typeof successUrl !== 'string') {
                res.status(400).json({ error: "Missing or invalid successUrl" });
                return;
            }
            if (!cancelUrl || typeof cancelUrl !== 'string') {
                res.status(400).json({ error: "Missing or invalid cancelUrl" });
                return;
            }
            // Získat UID z Authorization header nebo z requestu
            let userId = uid || null;
            const authHeader = req.headers.authorization;
            if (authHeader && typeof authHeader === 'string' && authHeader.startsWith("Bearer ")) {
                try {
                    const token = authHeader.substring(7).trim();
                    if (token && /^[A-Za-z0-9._-]+$/.test(token)) {
                        const decodedToken = await admin.auth().verifyIdToken(token);
                        userId = decodedToken.uid;
                    }
                }
                catch (error) {
                    functions.logger.warn("⚠️ Could not verify token", { error });
                }
            }
            if (!userId) {
                res.status(401).json({ error: "Unauthorized - missing user ID" });
                return;
            }
            const db = admin.firestore();
            // BACKEND KONTROLA: Zkontrolovat, zda uživatel už někdy měl trial
            let hasUsedTrial = false;
            try {
                const subsRef = db.collection("customers").doc(userId).collection("subscriptions");
                const subsSnap = await subsRef.get();
                if (!subsSnap.empty) {
                    for (const subDoc of subsSnap.docs) {
                        const subData = subDoc.data();
                        // Kontrola 1: Status je "trialing"
                        if (subData.status === 'trialing') {
                            hasUsedTrial = true;
                            break;
                        }
                        // Kontrola 2: Subscription má trial_period_start nebo trial_period_end
                        if (subData.trial_start || subData.trial_end) {
                            hasUsedTrial = true;
                            break;
                        }
                        // Kontrola 3: Subscription má trial_start nebo trial_end v items
                        if (subData.items && Array.isArray(subData.items)) {
                            for (const item of subData.items) {
                                if (item.trial_start || item.trial_end) {
                                    hasUsedTrial = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            catch (error) {
                functions.logger.error("❌ Error checking trial history", { error, userId });
                // V případě chyby raději nepovolit trial (bezpečnější)
                hasUsedTrial = true;
            }
            functions.logger.info("🔍 Trial check result", {
                userId,
                hasUsedTrial,
                planId
            });
            // Připravit data pro Checkout Session
            const sessionData = {
                price: priceId,
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                allow_promotion_codes: true,
                invoice_creation: {
                    enabled: true,
                    invoice_data: {
                        description: planId === 'business' ? 'Měsíční předplatné - Firma' : 'Měsíční předplatné - Hobby uživatel',
                        custom_fields: [
                            {
                                name: 'Typ faktury',
                                value: 'Předplatné'
                            }
                        ]
                    }
                }
            };
            // Nastavit trial POUZE pokud uživatel ještě trial neměl
            if ((planId === 'hobby' || planId === 'business') && !hasUsedTrial) {
                sessionData.trial_period_days = 30;
                functions.logger.info("✅ Trial period nastaven", { userId, planId });
            }
            else if (hasUsedTrial) {
                functions.logger.info("⚠️ Trial period NENÍ nastaven - uživatel už trial použil", { userId, planId });
            }
            // Vytvořit Checkout Session dokument (Firebase Extension to zpracuje)
            const checkoutRef = await db
                .collection("customers")
                .doc(userId)
                .collection("checkout_sessions")
                .add(sessionData);
            functions.logger.info("✅ Checkout session dokument vytvořen", {
                userId,
                checkoutSessionId: checkoutRef.id,
                hasTrial: !!sessionData.trial_period_days
            });
            // Vrátit ID checkout session (frontend bude pollovat URL)
            res.status(200).json({
                checkoutSessionId: checkoutRef.id,
                hasTrial: !!sessionData.trial_period_days
            });
        }
        catch (error) {
            functions.logger.error("❌ Chyba při vytváření checkout session", {
                error: error === null || error === void 0 ? void 0 : error.message,
                stack: error === null || error === void 0 ? void 0 : error.stack
            });
            res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "Internal server error" });
        }
    });
});
/**
 * Firestore trigger: Odešle email upozornění při nové zprávě v chatu
 * Spouští se automaticky při vytvoření nové zprávy v messages kolekci
 */
exports.onChatMessageCreated = functions
    .region("europe-west1")
    .firestore
    .document("conversations/{conversationId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const messageData = snap.data();
    const conversationId = context.params.conversationId;
    const messageId = snap.id;
    functions.logger.info("📨 onChatMessageCreated triggered", {
        conversationId,
        messageId,
        hasSenderId: !!messageData.senderId,
        isAdInfo: !!messageData.isAdInfo,
    });
    try {
        // Získat data zprávy
        const senderId = messageData.senderId;
        if (!senderId) {
            functions.logger.warn("Message without senderId", { messageId });
            return;
        }
        // Přeskočit systémové zprávy
        if (messageData.isAdInfo) {
            functions.logger.info("Skipping system message (isAdInfo)", { messageId });
            return;
        }
        // Získat konverzaci
        const conversationRef = db.doc(`conversations/${conversationId}`);
        const conversationSnap = await conversationRef.get();
        if (!conversationSnap.exists) {
            functions.logger.warn("Conversation not found", { conversationId });
            return;
        }
        const conversationData = conversationSnap.data();
        const participants = conversationData.participants || [];
        functions.logger.info("Conversation data loaded", {
            conversationId,
            participants,
            senderId,
        });
        // Najít příjemce (ten, který není odesílatel)
        const recipientId = participants.find((uid) => uid !== senderId);
        if (!recipientId) {
            functions.logger.warn("No recipient found", { conversationId, senderId, participants });
            return;
        }
        functions.logger.info("Recipient found", { recipientId });
        // Zkontrolovat nastavení upozornění příjemce
        const recipientProfileRef = db.doc(`users/${recipientId}/profile/profile`);
        const recipientProfileSnap = await recipientProfileRef.get();
        if (!recipientProfileSnap.exists) {
            functions.logger.warn("Recipient profile not found", { recipientId });
            return;
        }
        const recipientProfile = recipientProfileSnap.data();
        functions.logger.info("Recipient profile loaded", {
            recipientId,
            chatNotifications: recipientProfile.chatNotifications,
        });
        // Pokud má uživatel vypnuté upozornění, nepokračovat
        // Výchozí hodnota je true (pokud není explicitně false)
        if (recipientProfile.chatNotifications === false) {
            functions.logger.info("Chat notifications disabled for user", { recipientId });
            return;
        }
        // Získat email příjemce - zkusit z profilu, pak z auth
        let recipientEmail = recipientProfile.email;
        if (!recipientEmail) {
            try {
                const recipientUser = await admin.auth().getUser(recipientId);
                recipientEmail = recipientUser.email;
            }
            catch (authError) {
                functions.logger.error("Error getting recipient user from auth", {
                    recipientId,
                    error: authError === null || authError === void 0 ? void 0 : authError.message,
                });
            }
        }
        if (!recipientEmail) {
            functions.logger.warn("Recipient has no email", {
                recipientId,
                profileEmail: recipientProfile.email,
            });
            return;
        }
        functions.logger.info("Recipient email obtained", { recipientId, recipientEmail });
        // Získat jméno příjemce
        const recipientName = await getUserNameFromProfile(recipientId);
        // Získat jméno odesílatele
        const senderName = await getUserNameFromProfile(senderId);
        // Získat text zprávy (nebo placeholder pro obrázky)
        const messageText = messageData.text || (messageData.images && messageData.images.length > 0
            ? `📷 ${messageData.images.length} obrázek${messageData.images.length > 1 ? 'ů' : ''}`
            : 'Nová zpráva');
        // Získat název inzerátu, pokud existuje
        const adTitle = conversationData.listingTitle || 'inzerát';
        const adId = conversationData.listingId;
        const chatUrl = `https://bulldogo.cz/chat.html?conversationId=${conversationId}`;
        // Vytvořit HTML email pomocí univerzální šablony
        const content = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #111827; line-height: 1.6;">
          <strong>${senderName}</strong> vám poslal${senderName.endsWith('a') ? 'a' : ''} novou zprávu${adId ? ` ohledně inzerátu "${adTitle}"` : ''}.
        </p>
        
        <!-- Zpráva -->
        <div style="background: #f8f9fa; border-left: 4px solid #f77c00; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${messageText}</p>
        </div>
      `;
        const emailHTML = generateEmailTemplate({
            title: "💬 Nová zpráva v chatu",
            userName: recipientName,
            content,
            buttonText: "Otevřít chat",
            buttonUrl: chatUrl,
            footerText: `Tento email jste obdrželi, protože máte zapnutá upozornění na nové zprávy v chatu. Můžete je vypnout v <a href="https://bulldogo.cz/profile-settings.html" style="color: #f77c00; text-decoration: none;">nastavení</a>.`
        });
        // Odeslat email
        functions.logger.info("Attempting to send email", {
            recipientId,
            recipientEmail,
            senderId,
            senderName,
            conversationId,
        });
        try {
            await smtpTransporter.sendMail({
                from: {
                    name: "BULLDOGO",
                    address: "info@bulldogo.cz",
                },
                to: recipientEmail,
                subject: `💬 Nová zpráva od ${senderName}${adId ? ` - ${adTitle}` : ''}`,
                html: emailHTML,
                text: `Ahoj ${recipientName},\n\n${senderName} vám poslal${senderName.endsWith('a') ? 'a' : ''} novou zprávu${adId ? ` ohledně inzerátu "${adTitle}"` : ''}:\n\n${messageText}\n\nOtevřít chat: ${chatUrl}\n\nTento email jste obdrželi, protože máte zapnutá upozornění na nové zprávy v chatu. Můžete je vypnout v nastavení: https://bulldogo.cz/profile-settings.html`,
            });
            functions.logger.info("📧 Email upozornění na novou zprávu odeslán", {
                recipientId,
                recipientEmail,
                senderId,
                conversationId,
            });
        }
        catch (emailError) {
            functions.logger.error("❌ Chyba při odesílání emailu", {
                error: emailError === null || emailError === void 0 ? void 0 : emailError.message,
                stack: emailError === null || emailError === void 0 ? void 0 : emailError.stack,
                recipientEmail,
            });
            throw emailError;
        }
    }
    catch (error) {
        functions.logger.error("❌ Chyba při odesílání emailu upozornění na novou zprávu", {
            error: error === null || error === void 0 ? void 0 : error.message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
            conversationId,
            messageId: snap.id,
        });
    }
});
/**
 * Scheduled job: Automaticky deaktivuje vypršené topování inzerátů
 * Spouští se každou hodinu
 */
exports.expireTopAds = functions
    .region("europe-west1")
    .pubsub.schedule("0 * * * *") // Každou hodinu
    .timeZone("Europe/Prague")
    .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    let expiredCount = 0;
    let processedCount = 0;
    try {
        functions.logger.info("🕒 Spouštím kontrolu expirace topování inzerátů", {
            timestamp: now.toISOString(),
        });
        // Projít všechny uživatele
        const usersSnapshot = await db.collection("users").get();
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userAdsRef = db.collection(`users/${userId}/inzeraty`);
            const userAdsSnapshot = await userAdsRef.get();
            for (const adDoc of userAdsSnapshot.docs) {
                processedCount++;
                const adData = adDoc.data();
                // Kontrola zda je TOP a má čas expirace
                if (adData.isTop && adData.topExpiresAt) {
                    const expiresAt = adData.topExpiresAt.toDate
                        ? adData.topExpiresAt.toDate()
                        : new Date(adData.topExpiresAt);
                    if (now > expiresAt) {
                        // TOP vypršel - zrušit TOP status
                        try {
                            await adDoc.ref.update({
                                isTop: false,
                                topExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                            expiredCount++;
                            functions.logger.info("✅ Topování deaktivováno", {
                                userId,
                                adId: adDoc.id,
                                expiredAt: expiresAt.toISOString(),
                            });
                        }
                        catch (updateError) {
                            functions.logger.error("❌ Chyba při deaktivaci topování", {
                                userId,
                                adId: adDoc.id,
                                error: updateError === null || updateError === void 0 ? void 0 : updateError.message,
                            });
                        }
                    }
                }
            }
        }
        functions.logger.info("🕒 Kontrola expirace topování dokončena", {
            processedCount,
            expiredCount,
            timestamp: now.toISOString(),
        });
    }
    catch (error) {
        functions.logger.error("❌ Chyba při kontrole expirace topování", {
            error: error === null || error === void 0 ? void 0 : error.message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
            processedCount,
            expiredCount,
        });
    }
});
//# sourceMappingURL=index.js.map
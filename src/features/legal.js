// Textes légaux (français, contexte suisse / Vaud). Servis dans une modale.
// Placeholders à compléter par l'éditeur : [ADRESSE E-MAIL DE CONTACT].
// Dernière mise à jour : 16 juillet 2026.

export const LEGAL_UPDATED = '16 juillet 2026';

export const PRIVACY_TITLE = 'Politique de confidentialité';
export const TERMS_TITLE = "Conditions d'utilisation";

export const PRIVACY_HTML = `
<p style="color: var(--color-text-muted); font-size: 0.8rem; margin-top: 0;">Dernière mise à jour : ${LEGAL_UPDATED}</p>

<p>La présente politique explique quelles données personnelles Notare (« l'application », « nous ») collecte, pourquoi, et quels sont vos droits. Elle est établie conformément à la Loi fédérale suisse sur la protection des données (nLPD) et, lorsque le Règlement général européen sur la protection des données (RGPD) s'applique, à ce dernier.</p>

<h3>1. Responsable du traitement</h3>
<p>Notare est édité par Pranathi Alikatte. Pour toute question relative à vos données : <strong>[ADRESSE E-MAIL DE CONTACT]</strong>.</p>

<h3>2. Données que nous collectons</h3>
<p><strong>Données obligatoires (à la création du compte) :</strong> nom, prénom, adresse e-mail.</p>
<p><strong>Données facultatives (page « Profil ») :</strong> canton, établissement / école, numéro de téléphone, date de naissance.</p>
<p><strong>Données scolaires :</strong> les branches, notes, objectifs et éventuelles photos d'épreuves que vous saisissez. Ces données servent uniquement au suivi de vos moyennes.</p>
<p><strong>Données techniques :</strong> stockage local du navigateur (localStorage / IndexedDB) et cookie de session pour vous maintenir connecté.</p>

<h3>3. Finalités</h3>
<p>Vos données servent à : créer et sécuriser votre compte, sauvegarder et synchroniser vos notes entre vos appareils, calculer vos moyennes et votre statut de promotion, et vous permettre de gérer votre profil.</p>

<h3>4. Base légale</h3>
<p>Le traitement repose sur votre <strong>consentement</strong> (donné à l'inscription) et sur l'exécution du service que vous demandez. Vous pouvez retirer votre consentement à tout moment (voir la section « Vos droits »).</p>

<h3>5. Hébergement et sous-traitants</h3>
<p>Les données de compte et de synchronisation sont hébergées par <strong>Supabase</strong>, notre sous-traitant technique, sur une infrastructure sécurisée. Nous ne vendons ni ne louons vos données. Aucune donnée n'est transmise à des tiers à des fins publicitaires.</p>

<h3>6. Sécurité</h3>
<p>L'accès aux données est protégé par une politique de sécurité au niveau des lignes (Row Level Security) : chaque utilisateur ne peut lire ni modifier que ses propres données. Les échanges sont chiffrés (HTTPS) et les mots de passe ne sont jamais stockés en clair.</p>

<h3>7. Durée de conservation</h3>
<p>Vos données sont conservées tant que votre compte existe. À la suppression du compte, vos données personnelles et scolaires sont effacées.</p>

<h3>8. Vos droits</h3>
<p>Conformément à la nLPD et au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité, d'opposition et de retrait du consentement. Pour les exercer, écrivez à <strong>[ADRESSE E-MAIL DE CONTACT]</strong>. Vous pouvez aussi adresser une réclamation au Préposé fédéral à la protection des données et à la transparence (PFPDT).</p>

<h3>9. Mineurs</h3>
<p>Notare s'adresse à des élèves de gymnase, dont certains sont mineurs. Si vous avez moins de 16 ans, l'utilisation de l'application et la fourniture de vos données requièrent l'accord d'un parent ou représentant légal.</p>

<h3>10. Stockage local et cookies</h3>
<p>L'application utilise le stockage local de votre navigateur pour fonctionner hors ligne, ainsi qu'un cookie strictement nécessaire à la session. Aucun cookie publicitaire ou de pistage n'est utilisé.</p>

<h3>11. Transferts hors de Suisse / UE</h3>
<p>Selon la région d'hébergement choisie, certaines données peuvent être traitées hors de Suisse ou de l'UE. Le cas échéant, des garanties appropriées (clauses contractuelles types) encadrent ces transferts.</p>

<h3>12. Modifications</h3>
<p>Cette politique peut être mise à jour. La date en tête indique la dernière version. En cas de changement important, nous vous en informerons dans l'application.</p>
`;

export const TERMS_HTML = `
<p style="color: var(--color-text-muted); font-size: 0.8rem; margin-top: 0;">Dernière mise à jour : ${LEGAL_UPDATED}</p>

<h3>1. Objet</h3>
<p>Les présentes conditions régissent l'utilisation de Notare, application de suivi des notes destinée aux élèves du gymnase vaudois. En créant un compte ou en utilisant l'application, vous acceptez ces conditions.</p>

<h3>2. Description du service</h3>
<p>Notare permet de saisir des notes, de calculer des moyennes, de suivre des points de promotion et de simuler des objectifs. L'application peut fonctionner hors ligne (données locales) et, si vous avez un compte, synchroniser vos données dans le cloud.</p>

<h3>3. Caractère indicatif des calculs</h3>
<p><strong>Important :</strong> les moyennes, statuts de promotion et simulations fournis par Notare sont <strong>purement indicatifs</strong>. Ils ne constituent pas un résultat officiel. Seuls les bulletins et décisions de votre établissement font foi. Vérifiez toujours vos résultats auprès de votre gymnase.</p>

<h3>4. Compte utilisateur</h3>
<p>Vous êtes responsable de l'exactitude des informations fournies et de la confidentialité de votre mot de passe. Vous vous engagez à ne pas utiliser le compte d'autrui.</p>

<h3>5. Utilisation acceptable</h3>
<p>Vous vous engagez à ne pas détourner l'application, tenter d'accéder aux données d'autres utilisateurs, ni perturber le service. Tout usage illicite peut entraîner la suspension du compte.</p>

<h3>6. Propriété intellectuelle</h3>
<p>L'application, son design et son code demeurent la propriété de leur auteur. Les données que vous saisissez restent les vôtres.</p>

<h3>7. Disponibilité et absence de garantie</h3>
<p>L'application est fournie « en l'état », sans garantie de disponibilité continue ni d'absence d'erreur. Nous nous efforçons d'assurer la fiabilité des calculs mais ne pouvons la garantir.</p>

<h3>8. Limitation de responsabilité</h3>
<p>Dans les limites permises par la loi, l'éditeur ne saurait être tenu responsable de dommages résultant de l'utilisation de l'application, notamment de décisions prises sur la base de calculs indicatifs.</p>

<h3>9. Résiliation</h3>
<p>Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre un compte en cas de violation des présentes conditions.</p>

<h3>10. Droit applicable et for</h3>
<p>Les présentes conditions sont soumises au droit suisse. Le for exclusif est, dans la mesure permise par la loi, celui du canton de Vaud.</p>

<h3>11. Modifications</h3>
<p>Ces conditions peuvent évoluer. La date en tête indique la dernière version.</p>

<h3>12. Contact</h3>
<p>Pour toute question : <strong>[ADRESSE E-MAIL DE CONTACT]</strong>.</p>
`;

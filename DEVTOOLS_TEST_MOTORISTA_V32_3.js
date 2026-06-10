(async function () {
  "use strict";
  console.log("🧪 JM V32.3 FINAL — painel motorista");
  if (!window.firebase) throw new Error("Firebase não encontrado. Abra motorista.html e faça login.");
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Motorista não está logado.");
  const db = firebase.firestore();
  console.table({ uid: user.uid, email: user.email });
  const profile = await db.collection("users").doc(user.uid).get();
  console.log("Perfil:", profile.exists ? profile.data() : "NÃO EXISTE");
  const settings = await db.collection("settings").doc("integrations").get();
  console.log("Integrações legíveis:", settings.exists);
  const calls = await db.collection("calls").where("driverId", "==", user.uid).limit(20).get();
  console.log("Chamados vinculados por driverId:", calls.size);
  console.table(calls.docs.map((doc) => ({ id: doc.id, status: doc.data().statusKey || doc.data().status, cliente: doc.data().cliente || doc.data().clientName || "" })));
  console.log("✅ Teste de leitura do motorista concluído. GPS/provas devem ser testados pelos botões reais para validar permissões do navegador e Cloudinary.");
})().catch((error) => console.error("❌ TESTE MOTORISTA:", error));

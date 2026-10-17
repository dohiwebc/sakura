// Firebase Web config is public by design. Authorization is enforced in database.rules.json.
(() => {
  'use strict';
  const config = {
  "apiKey": "AIzaSyC2sPMvyMQZDlys0McPPxZvpKhmztod2ho",
  "authDomain": "dodge-player-7a5ff.firebaseapp.com",
  "databaseURL": "https://dodge-player-7a5ff-default-rtdb.asia-southeast1.firebasedatabase.app",
  "projectId": "dodge-player-7a5ff",
  "storageBucket": "dodge-player-7a5ff.firebasestorage.app",
  "messagingSenderId": "752106851441",
  "appId": "1:752106851441:web:7081da0e058980ab479fd0",
  "measurementId": "G-84DLRYS2X4"
};
  const app = firebase.initializeApp(config);
  const auth = firebase.auth(app);
  const db = firebase.database(app);
  let resolveReady;
  let canEdit = false;
  let wasAllowed = false;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  window.SakuraAccess = { app, db, auth, ready, get canEdit() { return canEdit; } };
  const style = document.createElement('style');
  style.textContent = 'html:not([data-team-access="allowed"]) body > :not(#team-access-panel):not(script):not(style){display:none!important} #team-access-panel{position:relative;z-index:1000;padding:20px;box-sizing:border-box;background:#111120;color:#ede0c4;border-bottom:1px solid #8a7050;font:14px sans-serif;overflow-wrap:anywhere} #team-access-panel button{padding:10px 16px;margin:6px;background:#ffd700;color:#07070f;border:0;border-radius:4px;cursor:pointer} #team-access-panel input{padding:10px;margin:6px;color:#ede0c4;background:#07070f;border:1px solid #8a7050} #team-access-panel [hidden]{display:none!important}';
  document.head.appendChild(style);
  function mount() {
    const panel = document.createElement('div');
    panel.id = 'team-access-panel';
    panel.setAttribute('aria-label', 'チームのログイン');
    panel.innerHTML = '<strong>さくらGroup・チーム専用</strong><p id="team-access-status" role="status">ログイン状態を確認しています…</p><button id="team-sign-in" hidden>Googleでログイン</button><button id="team-sign-out" hidden>ログアウト</button><details id="team-member-admin" hidden><summary>閲覧メンバーの管理</summary><p>メンバーがログイン後に表示されるユーザーIDを登録します。登録した人はチームデータを閲覧できます。</p><label>ユーザーID <input id="team-member-uid" autocomplete="off" maxlength="128"></label><button id="team-member-add">閲覧を許可</button><button id="team-member-remove">閲覧許可を解除</button><p id="team-member-result" role="status"></p></details>';
    document.body.prepend(panel);
    const status = panel.querySelector('#team-access-status');
    const signIn = panel.querySelector('#team-sign-in');
    const signOut = panel.querySelector('#team-sign-out');
    const memberAdmin = panel.querySelector('#team-member-admin');
    let stopMembership;
    signIn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      signIn.disabled = true;
      try { await auth.signInWithPopup(provider); }
      catch (error) { status.textContent = 'ログインできませんでした。もう一度お試しください。 (' + error.code + ')'; }
      finally { signIn.disabled = false; }
    });
    signOut.addEventListener('click', async () => { await auth.signOut(); location.reload(); });
    async function updateMember(allow) {
      if (!canEdit) return;
      const uid = panel.querySelector('#team-member-uid').value.trim();
      const result = panel.querySelector('#team-member-result');
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) { result.textContent = '正しいユーザーIDを入力してください。'; return; }
      if (!confirm('このユーザーのチームデータ閲覧を' + (allow ? '許可' : '解除') + 'しますか？')) return;
      try { await db.ref('teamMembers/' + uid).set(allow ? true : null); result.textContent = allow ? '閲覧を許可しました。' : '閲覧許可を解除しました。'; }
      catch (error) { result.textContent = '更新できませんでした。 (' + error.code + ')'; }
    }
    panel.querySelector('#team-member-add').addEventListener('click', () => updateMember(true));
    panel.querySelector('#team-member-remove').addEventListener('click', () => updateMember(false));
    auth.onAuthStateChanged(user => {
      if (stopMembership) { stopMembership(); stopMembership = null; }
      document.documentElement.removeAttribute('data-team-access');
      memberAdmin.hidden = true;
      canEdit = false;
      signIn.hidden = !!user;
      signOut.hidden = !user;
      if (!user) { status.textContent = 'チームデータを見るにはGoogleでログインしてください。'; return; }
      status.textContent = 'チームの閲覧権限を確認しています…';
      const membership = db.ref('teamMembers/' + user.uid);
      const listener = async snapshot => {
        try {
          const token = await user.getIdTokenResult();
          const verifiedGoogle = token.claims.email_verified === true && token.signInProvider === 'google.com';
          canEdit = verifiedGoogle && user.email === 'sakuragroup20232023@gmail.com';
          const allowed = verifiedGoogle && (canEdit || snapshot.val() === true);
          if (!allowed) {
            status.textContent = '閲覧の許可が必要です。管理者へこのユーザーIDを伝えてください: ' + user.uid;
            if (wasAllowed) location.reload();
            return;
          }
          status.textContent = (user.email || 'ログイン中') + (canEdit ? '（管理者）' : '（閲覧のみ）');
          memberAdmin.hidden = !canEdit;
          document.documentElement.dataset.teamAccess = 'allowed';
          document.querySelectorAll('[data-admin-only]').forEach(el => { el.disabled = !canEdit; });
          if (document.body.dataset.adminPage && !canEdit) {
            document.querySelectorAll('body > main, body > nav, body > section').forEach(el => { el.style.setProperty('display', 'none', 'important'); });
            status.textContent += ' この管理画面の操作は管理者専用です。';
          }
          wasAllowed = true;
          resolveReady({ user, canEdit });
        } catch (error) { status.textContent = '権限を確認できませんでした。再ログインしてください。'; }
      };
      membership.on('value', listener, () => { status.textContent = '権限を確認できませんでした。管理者に連絡してください。'; });
      stopMembership = () => membership.off('value', listener);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();

export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'jinwoo_auth=; Path=/; HttpOnly; Max-Age=0');
  res.redirect(302, '/login');
}

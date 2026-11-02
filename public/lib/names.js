// 「岩田 勝（架空）」→「岩田」（ブラウザとサーバーの両方で使う）
export const surname = (name) => String(name).replace(/（架空）/g, '').trim().split(/\s+/)[0];

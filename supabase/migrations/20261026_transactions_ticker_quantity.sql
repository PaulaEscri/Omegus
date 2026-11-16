-- Añade ticker (símbolo bursátil) y quantity (nº de unidades/acciones) a
-- transactions, para poder calcular el valor de mercado real de la cartera
-- de inversión en /cartera. Ambos son opcionales: sin ellos, Cartera sigue
-- mostrando el valor invertido como estimación.
alter table transactions
  add column if not exists ticker text,
  add column if not exists quantity numeric(18, 6);

comment on column transactions.ticker is 'Símbolo bursátil (ej. AAPL, BTC-USD) usado para consultar el precio de mercado actual.';
comment on column transactions.quantity is 'Número de unidades/acciones compradas en esta transacción de inversión.';

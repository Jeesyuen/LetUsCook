import unittest


def calculate_landed_cost(base_price: float, qty: int, delivery_fee: float = 0.0) -> float:
    """Calculate true landed unit cost including delivery surcharge."""
    if qty <= 0:
        return 0.0
    return round(((base_price * qty) + delivery_fee) / qty, 2)


def days_until_stockout(current_stock: float, daily_burn_rate: float) -> float:
    """Calculate days of stock cover remaining based on daily consumption rate."""
    if daily_burn_rate <= 0:
        return float("inf")
    return round(current_stock / daily_burn_rate, 1)


class TestSupplyWiseUtils(unittest.TestCase):
    def test_calculate_landed_cost(self):
        # 10 kg of coffee beans at RM 100/kg with RM 20 delivery
        unit_cost = calculate_landed_cost(100.0, 10, 20.0)
        self.assertEqual(unit_cost, 102.0)

    def test_days_until_stockout(self):
        # 12 kg current stock, 3 kg daily burn rate = 4.0 days cover
        days = days_until_stockout(12.0, 3.0)
        self.assertEqual(days, 4.0)

    def test_zero_burn_rate(self):
        days = days_until_stockout(12.0, 0.0)
        self.assertEqual(days, float("inf"))


if __name__ == "__main__":
    unittest.main()

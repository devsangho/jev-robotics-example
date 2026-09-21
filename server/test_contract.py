import unittest
from run_libero import validate_candidates


class CandidateContractTest(unittest.TestCase):
    def fixture(self):
        return {"observation_text": "Gripper above cube", "candidates": [
            {"description": "Grasp cube", "actions": [[0, 0, 0, 0, 0, 0, 1]]}
        ]}

    def test_valid_controller_action(self):
        self.assertEqual(len(validate_candidates(self.fixture())), 1)

    def test_rejects_nonfinite_out_of_range_or_wrong_dimension(self):
        for action in ([float('nan')] * 7, [float('inf')] * 7, [2] * 7, [0] * 6, [False] * 7):
            data = self.fixture()
            data['candidates'][0]['actions'] = [action]
            with self.assertRaises(ValueError):
                validate_candidates(data)

    def test_requires_grounded_observation_and_description(self):
        for field in ('observation_text', 'description'):
            data = self.fixture()
            if field == 'observation_text':
                data[field] = ''
            else:
                data['candidates'][0][field] = ''
            with self.assertRaises(ValueError):
                validate_candidates(data)

    def test_rejects_empty_candidates_and_chunks(self):
        data = self.fixture()
        data['candidates'] = []
        with self.assertRaises(ValueError):
            validate_candidates(data)
        data = self.fixture()
        data['candidates'][0]['actions'] = []
        with self.assertRaises(ValueError):
            validate_candidates(data)


if __name__ == '__main__':
    unittest.main()

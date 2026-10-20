import unittest
from visuals import validate_visual
class VisualValidation(unittest.TestCase):
    def test_svg(self):
        self.assertTrue(validate_visual('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>')[0])
    def test_script_and_remote_rejected(self):
        for extra in ['<script>alert(1)</script>','<image href="https://example.com/a.svg"/>','<rect onclick="alert(1)"/>']:
            self.assertFalse(validate_visual('<svg xmlns="http://www.w3.org/2000/svg">'+extra+'</svg>')[0])
    def test_animation_required(self):
        self.assertFalse(validate_visual('<!doctype html><html><body><p>static</p></body></html>',True)[0])
    def test_css_animation(self):
        self.assertTrue(validate_visual('<!doctype html><html><head><style>@keyframes pulse{to{opacity:0}}.a{animation:pulse 2s infinite}</style></head><body><div class="a">hello</div></body></html>',True)[0])
if __name__=='__main__': unittest.main()

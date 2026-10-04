"""Django project package initialization."""

# PyMySQL is a pure-Python MySQL driver that works with this Windows/Python
# setup. Django's MySQL backend imports the driver under the MySQLdb name.
import pymysql

pymysql.install_as_MySQLdb()
